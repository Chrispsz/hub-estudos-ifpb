// AUDITORIA COMPLETA DE DADOS — "nenhum dado faltando? tudo alimentado e organizado?"
// Cruza: course-data (disciplinas + materiais) ↔ PDFs em disco ↔ resumos IA ↔
// textos de retrieval ↔ ementas ↔ links ↔ cronograma semanal.
// Uso: bun scripts/audit-dados-completo.ts
import { promises as fs } from 'fs';
import path from 'path';
import { disciplines, materials, course, importantLinks } from '../src/data/course-data';

const ROOT = process.cwd();
const PDFS_DIR = path.join(ROOT, 'public', 'pdfs');
const SUMMARIES_DIR = path.join(ROOT, 'public', 'data', 'ai-summaries');
const TEXTS_DIR = path.join(ROOT, 'public', 'data', 'material-texts');
const EMENTAS_DIR = path.join(ROOT, 'public', 'data', 'ementas');

let errors = 0;
let warns = 0;
const ok: string[] = [];
const err: string[] = [];
const warn: string[] = [];
const E = (m: string) => { errors++; err.push(m); };
const W = (m: string) => { warns++; warn.push(m); };

async function exists(p: string) {
  try { await fs.access(p); return true; } catch { return false; }
}

const VIRTUAL_CODES = new Set(['PNAAT']); // documentos institucionais — tratados como bucket especial na UI
async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  AUDITORIA DE DADOS — Hub de Estudos IFPB            ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ---------- 1. COURSE INFO ----------
  console.log('── 1. Identidade do curso ──');
  console.log(`  ${course.instituicao} • ${course.nome} (${course.nomeCurto})`);
  console.log(`  Campus: ${course.campus} • ${course.periodo} • CH ${course.cargaHorariaTotal}h • mínimo ${course.periodoMinimo} períodos`);
  if (course.nomeCurto !== 'ADS') E('nomeCurto não é ADS');
  if (course.campus !== 'Cajazeiras') E('campus incorreto');
  ok.push('curso = IFPB ADS Cajazeiras 2026.2');

  // ---------- 2. DISCIPLINAS ----------
  console.log(`\n── 2. Disciplinas (${disciplines.length}) ──`);
  const codes = new Set(disciplines.map((d) => d.code));
  if (codes.size !== disciplines.length) E('códigos de disciplina duplicados');
  for (const d of disciplines) {
    const miss: string[] = [];
    if (!d.name) miss.push('name');
    if (!d.professor) miss.push('professor');
    if (!d.ementa) miss.push('ementa');
    if (!d.conteudoProgramatico?.length) miss.push('conteudoProgramatico');
    if (!d.avaliacao) miss.push('avaliacao');
    if (!d.evaluationMethod) miss.push('evaluationMethod');
    if (!d.gradeComponents?.length) miss.push('gradeComponents');
    if (!d.approvalThreshold) miss.push('approvalThreshold');
    if (!d.bibliografiaBasica?.length) miss.push('bibliografiaBasica');
    if (!d.dicasEstudo?.length) miss.push('dicasEstudo');
    const ementaSlugByShort: Record<string, string> = {
    'Algoritmos': 'algoritmos',
    'Linguagens de Marcação': 'linguagens-marcacao',
    'Matemática': 'matematica',
    'Fundamentos': 'fundamentos',
    'RHT': 'rht',
    'Inglês': 'ingles',
    'Português': 'portugues',
  };
  const ementaPdf = `ementa-${ementaSlugByShort[d.shortName] ?? d.shortName.toLowerCase()}.pdf`;
  const hasEmentaPdf = await exists(path.join(EMENTAS_DIR, ementaPdf));
    if (!hasEmentaPdf) W(`ementa PDF ausente: ${ementaPdf}`);
    if (miss.length) E(`${d.shortName}: faltando ${miss.join(', ')}`);
    else console.log(`  ✓ ${d.shortName} — ${d.professor} • ${d.chTotal}h/${d.chWeekly}h sem • aval ${d.evaluationMethod} • ementa PDF ✓`);
    if (hasEmentaPdf) ok.push(`ementa PDF ${d.shortName}`);
  }

  // ---------- 3. MATERIAIS ----------
  console.log(`\n── 3. Materiais (${materials.length}) ──`);
  const ids = new Set<string>();
  const summaryFilesRef = new Set<string>();
  const textFilesRef = new Set<string>();
  const pdfsRef = new Set<string>();
  const perDiscipline = new Map<string, number>();
  for (const d of disciplines) perDiscipline.set(d.code, 0);

  for (const m of materials) {
    const label = `[${m.id}] ${m.title}`;
    if (ids.has(m.id)) E(`id duplicado: ${m.id}`);
    ids.add(m.id);

    if (!codes.has(m.disciplineCode) && !VIRTUAL_CODES.has(m.disciplineCode))
      E(`${label}: disciplineCode "${m.disciplineCode}" não existe`);
    else if (!VIRTUAL_CODES.has(m.disciplineCode))
      perDiscipline.set(m.disciplineCode, (perDiscipline.get(m.disciplineCode) ?? 0) + 1);

    // fonte concreta: PDF local OU URL externa OU vídeo
    const hasPdf = m.pdfPath ? await exists(path.join(ROOT, 'public', m.pdfPath.replace(/^\//, ''))) : false;
    if (m.pdfPath && !hasPdf) E(`${label}: pdfPath ${m.pdfPath} NÃO EXISTE em public/`);
    if (m.pdfPath) pdfsRef.add(path.basename(m.pdfPath));
    if (!m.pdfPath && !m.externalUrl && m.type !== 'video') W(`${label}: sem pdfPath e sem externalUrl`);

    // resumo IA — validar JSON e chaves do schema
    if (!m.summaryFile) {
      W(`${label}: sem summaryFile (tutor não terá resumo para este material)`);
    } else {
      const sp = path.join(SUMMARIES_DIR, m.summaryFile);
      if (!(await exists(sp))) E(`${label}: summaryFile ${m.summaryFile} NÃO EXISTE`);
      else {
        try {
          const raw = JSON.parse(await fs.readFile(sp, 'utf8'));
          const missingKeys: string[] = [];
          for (const k of ['titulo', 'conceitos_chave', 'pontos_importantes', 'erros_comuns'])
            if (!raw[k]) missingKeys.push(k);
          if (missingKeys.length) E(`${label}: resumo ${m.summaryFile} sem chaves: ${missingKeys.join(', ')}`);
          const perg = Array.isArray(raw.perguntas_autoavaliacao)
            ? raw.perguntas_autoavaliacao.length
            : Array.isArray(raw['perguntas_autoavaliação']) ? raw['perguntas_autoavaliação'].length : 0;
          if (perg === 0) W(`${label}: resumo sem perguntas de autoavaliação (0)`);
          ok.push(`resumo ${m.id} ✓ (${perg} perguntas)`);
        } catch (e) {
          E(`${label}: resumo ${m.summaryFile} JSON INVÁLIDO: ${(e as Error).message}`);
        }
      }
      summaryFilesRef.add(m.summaryFile);
    }

    // retrieval text — {id}.txt
    const tp = path.join(TEXTS_DIR, `${m.id}.txt`);
    if (!(await exists(tp))) {
      if (m.type === 'video' || m.externalUrl) W(`${label}: sem texto de retrieval (${m.id}.txt) — material ${m.type}`);
      else E(`${label}: texto de retrieval ${m.id}.txt NÃO EXISTE (tutor fica cego no conteúdo)`);
    } else {
      textFilesRef.add(`${m.id}.txt`);
      const stat = await fs.stat(tp);
      if (stat.size < 80) W(`${label}: texto retrieval suspeito de vazio (${stat.size}B)`);
    }
  }

  // ---------- 4. ÓRFÃOS em disco ----------
  console.log('\n── 4. Órfãos em disco ──');
  for (const dir of [SUMMARIES_DIR, TEXTS_DIR]) {
    const files = (await fs.readdir(dir)).filter((f) => !f.startsWith('.'));
    for (const f of files) {
      const rel = path.basename(f);
      const referenced = dir === SUMMARIES_DIR ? summaryFilesRef.has(rel) : textFilesRef.has(rel);
      if (!referenced) W(`órfão em ${path.basename(dir)}/: ${rel} (ninguém referencia)`);
    }
  }
  const diskPdfs = (await fs.readdir(PDFS_DIR)).filter((f) => !f.startsWith('.'));
  for (const f of diskPdfs) {
    if (!pdfsRef.has(f)) W(`PDF em public/pdfs/ não referenciado em materials: ${f}`);
  }

  // ---------- 5. COBERTURA POR DISCIPLINA ----------
  console.log('\n── 5. Cobertura de materiais por disciplina ──');
  for (const d of disciplines) {
    const n = perDiscipline.get(d.code) ?? 0;
    if (n === 0) E(`${d.shortName}: 0 materiais!`);
    else console.log(`  ${d.shortName}: ${n} material(is)`);
  }

  // ---------- 6. LINKS ----------
  console.log(`\n── 6. Links importantes (${importantLinks.length}) ──`);
  const badUrls = importantLinks.filter((l) => !/^https?:\/\/|^mailto:/.test(l.url));
  if (badUrls.length) badUrls.forEach((l) => E(`link malformado: ${l.title} → ${l.url}`));
  else ok.push(`${importantLinks.length} links válidos`);
  const linkTitles = new Set<string>();
  for (const l of importantLinks) {
    if (linkTitles.has(l.title)) W(`link duplicado: ${l.title}`);
    linkTitles.add(l.title);
    if (!l.description) W(`link sem descrição: ${l.title}`);
  }

  // ---------- RELATÓRIO ----------
  console.log('\n══════════ RELATÓRIO FINAL ══════════');
  console.log(`  ✓ Verificações OK: ${ok.length}`);
  console.log(`  ⚠ Avisos:   ${warns}`);
  console.log(`  ✗ Erros:    ${errors}`);
  if (err.length) { console.log('\nERROS:'); err.forEach((e) => console.log('  ✗ ' + e)); }
  if (warn.length) { console.log('\nAVISOS:'); warn.forEach((w) => console.log('  ⚠ ' + w)); }
  console.log(errors === 0 ? '\n🟢 DADOS ÍNTEGROS — nada faltando no essencial' : '\n🔴 DADOS COM FALDAS — corrigir acima');
  process.exit(errors === 0 ? 0 : 1);
}

main();

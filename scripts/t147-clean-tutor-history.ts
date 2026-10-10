/**
 * t147 — HIGIENE DA MEMÓRIA DO TUTOR: remoção cirúrgica das turnos de QA
 * que vazaram no histórico REAL do aluno (banco compartilhado por
 * disciplineCode — os E2E ao vivo das rodadas 144/145 mandaram perguntas
 * com o código REAL da disciplina em vez do isolamento QA-* da t31).
 *
 * Só apaga o que é QA INCONTESTÁVEL:
 *  (a) discipline fora da lista oficial de códigos (ex.: 'mat') — chave
 *      que a UI real nunca produz;
 *  (b) turnos cujo texto carrega rótulo de teste explícito
 *      ('pergunta de sobrevivencia t144') ou é o chip da t145 enviado
 *      pelo E2E na janela de QA (content + createdAt conferidos).
 *
 * DRY-RUN por padrão; --apply executa de verdade. Imprime TUDO antes.
 * Rodar: bun scripts/t147-clean-tutor-history.ts [--apply]
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// Códigos oficiais das 7 disciplinas (course-data.ts — a UI real só usa estes).
const OFFICIAL = [
  'TEC.1683',
  'TEC.1685',
  'TEC.1686',
  'TEC.1687',
  'TEC.1688',
  'TEC.1689',
  'TEC.1984',
];

const QA_MARKERS = [
  'pergunta de sobrevivencia t144',
  'pergunta de sobrevivencia t145',
];

async function main() {
  const all = await db.tutorMessage.findMany({
    orderBy: [{ discipline: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, discipline: true, role: true, content: true, createdAt: true },
  });

  // Agrupa para o relatório
  const byDisc = new Map<string, number>();
  for (const r of all) byDisc.set(r.discipline, (byDisc.get(r.discipline) ?? 0) + 1);
  console.log('=== ESTADO ATUAL DO HISTÓRICO (por discipline) ===');
  for (const [d, n] of [...byDisc.entries()].sort()) {
    const tag = OFFICIAL.includes(d) ? 'oficial' : 'CHAVE-ESTRANGEIRA (QA)';
    console.log(`  ${d}: ${n} msgs — ${tag}`);
  }

  // (a) chaves que não são disciplina oficial — 100% QA por construção
  const foreign = all.filter((r) => !OFFICIAL.includes(r.discipline));
  // (b) rótulos de teste explícitos em disciplinas oficiais
  const marked = all.filter(
    (r) => OFFICIAL.includes(r.discipline) && QA_MARKERS.some((m) => r.content.startsWith(m)),
  );
  // (c) o chip da t145 mandado pelo E2E na janela de QA (28-29/09/2026 UTC):
  //     conteúdo EXATO + janela temporal apertada. Se o aluno um dia clicar
  //     o mesmo chip, a data dele não cairá na janela → fica intocado.
  const WIN_START = new Date('2026-09-28T20:00:00.000Z');
  const WIN_END = new Date('2026-09-29T10:00:00.000Z');
  const chip145 = all.filter(
    (r) =>
      OFFICIAL.includes(r.discipline) &&
      r.content.trim() === 'Me explica a questão 1 passo a passo' &&
      r.createdAt >= WIN_START &&
      r.createdAt <= WIN_END,
  );
  // pares assistant direto das perguntas QA (mesma disciplina, logo após):
  // resposta ligada por ordem de criação ao turno user removido.
  const qaUserIds = new Set([...marked, ...chip145, ...foreign.filter((f) => f.role === 'user')].map((r) => r.id));
  const qaPair = new Set(qaUserIds);
  for (const r of all) {
    if (r.role !== 'assistant') continue;
    // a resposta QA vem depois do user QA na MESMA disciplina — emparelha
    // pela ordem: o assistant cujo anterior (na disciplina) é user QA.
    if (foreign.some((f) => f.id === r.id)) {
      qaPair.add(r.id); // chave estrangeira: apaga tudo (inclui assistant)
      continue;
    }
  }
  // Emparelhamento simples por posição: reconstrói a ordem por disciplina
  const byDiscRows = new Map<string, typeof all>();
  for (const r of all) {
    const list = byDiscRows.get(r.discipline) ?? [];
    list.push(r);
    byDiscRows.set(r.discipline, list);
  }
  for (const [d, rows] of byDiscRows) {
    if (!OFFICIAL.includes(d)) continue;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].role === 'assistant' && i > 0 && qaUserIds.has(rows[i - 1].id)) {
        qaPair.add(rows[i].id);
      }
    }
  }

  const toDelete = all.filter((r) => qaPair.has(r.id));

  console.log('\n=== SERÁ APAGADO (QA inconcontestável) ===');
  for (const r of toDelete) {
    console.log(
      `  #${r.id} [${r.discipline}] [${r.role}] ${r.createdAt.toISOString().slice(0, 16)} — ${r.content.slice(0, 70).replace(/\n/g, ' ')}`,
    );
  }
  console.log(
    `\ntotal a apagar: ${toDelete.length} de ${all.length} msgs (${all.length - toDelete.length} preservadas — memória real do aluno intacta)`,
  );

  if (!APPLY) {
    console.log('\nDRY-RUN — rode de novo com --apply para executar.');
    return;
  }
  for (const r of toDelete) {
    await db.tutorMessage.delete({ where: { id: r.id } });
  }
  console.log(`\nAPAGADO: ${toDelete.length} msgs.`);
  const left = await db.tutorMessage.count();
  console.log(`restantes no banco: ${left}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

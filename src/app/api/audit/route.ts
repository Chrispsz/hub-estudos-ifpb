// AUDITORIA DE INTEGRIDADE DO ACERVO — usada pelo QA recorrente (curl /api/audit)
// Valida cross-references (materiais × exercícios × trilhas × PPC) com o mesmo
// bundler que serve os usuários. ok=true = zero erros de integridade.
import { NextResponse } from 'next/server';
import {
  disciplines,
  materials,
  calendarEvents,
  getDisciplineByCode,
} from '@/data/course-data';
import { exercises } from '@/lib/exercise-extractor';
import { getAlignmentStats, getUnitsOf, disciplineCoversSubtopico } from '@/lib/curriculum-state';
import { RECOVERY_TRACKS } from '@/lib/recovery-plan';
import { MATH_EXAM_PLAN, MATH_FORMULAS, MATH_CHECKLIST } from '@/lib/math-exam-prep';

export async function GET() {
  const erros: string[] = [];
  const avisos: string[] = [];
  const infos: string[] = [];

  // --- disciplinas ---
  const discCodes = new Set<string>();
  for (const d of disciplines) {
    if (discCodes.has(d.code)) erros.push(`disciplina: código duplicado ${d.code}`);
    discCodes.add(d.code);
    const seen = new Set<string>();
    for (const u of d.conteudoProgramatico) {
      if (seen.has(u.unidade)) erros.push(`${d.shortName}: unidade duplicada no PPC "${u.unidade}"`);
      seen.add(u.unidade);
    }
    if (d.gradeComponents.length === 0) erros.push(`${d.shortName}: sem gradeComponents`);
  }

  // --- materiais ---
  const matIds = new Set<string>();
  for (const m of materials) {
    if (matIds.has(m.id)) erros.push(`material: id duplicado ${m.id}`);
    matIds.add(m.id);
    if (!getDisciplineByCode(m.disciplineCode) && m.disciplineCode !== 'PNAAT')
      erros.push(`material ${m.id}: disciplineCode inexistente ${m.disciplineCode}`);
    if (m.topicosCobertos) {
      const units = getUnitsOf(m.disciplineCode);
      for (const t of m.topicosCobertos)
        if (!units.includes(t))
          erros.push(`material ${m.id}: topicosCobertos fora do PPC (${m.disciplineCode}): "${t}"`);
    }
  }

  // --- exercícios ---
  const exIds = new Set<string>();
  let gated = 0;
  for (const e of exercises) {
    if (exIds.has(e.id)) erros.push(`exercício: id duplicado ${e.id}`);
    exIds.add(e.id);
    if (!getDisciplineByCode(e.disciplineCode))
      erros.push(`exercício ${e.id}: disciplineCode inexistente ${e.disciplineCode}`);
    for (const lm of e.linkedMaterials ?? [])
      if (!matIds.has(lm)) erros.push(`exercício ${e.id}: linkedMaterial inexistente ${lm}`);
    if (e.unit) {
      const units = getUnitsOf(e.disciplineCode);
      if (!units.includes(e.unit))
        erros.push(`exercício ${e.id}: unit fora do PPC (${e.disciplineCode}): "${e.unit}"`);
    }
    if (e.requiresSubtopico) {
      gated++;
      const aberto = disciplineCoversSubtopico(e.disciplineCode, e.requiresSubtopico);
      infos.push(
        `exercício ${e.id}: gate "${e.requiresSubtopico}" ${aberto ? 'ABERTO' : 'fechado (aguardando aula)'}`,
      );
    }
  }

  // --- trilhas de recuperação ---
  for (const t of RECOVERY_TRACKS) {
    if (t.disciplineCode && !getDisciplineByCode(t.disciplineCode))
      erros.push(`trilha ${t.id}: disciplineCode inexistente ${t.disciplineCode}`);
    for (const a of t.acoes)
      if (a.materialId && !matIds.has(a.materialId))
        erros.push(`trilha ${t.id}: materialId inexistente ${a.materialId}`);
  }

  // --- plano da prova de matemática ---
  for (const p of MATH_EXAM_PLAN) {
    for (const t of p.tarefas) {
      if (t.materialId && !matIds.has(t.materialId))
        erros.push(`math-exam D-${p.offset}: materialId inexistente ${t.materialId}`);
      for (const eid of t.exercisePool ?? [])
        if (!exIds.has(eid)) erros.push(`math-exam D-${p.offset}: exercisePool inexistente ${eid}`);
    }
  }

  // --- calendário ---
  for (const ev of calendarEvents) {
    if (isNaN(new Date(ev.date + 'T12:00:00').getTime()))
      erros.push(`calendário: data inválida ${ev.date} (${ev.title})`);
  }

  // --- alinhamento material-first ---
  const stats = getAlignmentStats();
  if (stats.total !== exercises.length)
    avisos.push(`stats.total (${stats.total}) != exercises.length (${exercises.length})`);
  if (stats.emSala === 0) erros.push('nenhum exercício em_sala — material-first quebrado');

  infos.push(`fórmulas: ${MATH_FORMULAS.length}, checklist: ${MATH_CHECKLIST.length} grupos`);

  return NextResponse.json({
    resumo: `${disciplines.length} disciplinas · ${materials.length} materiais · ${exercises.length} exercícios`,
    gatesFino: gated,
    stats,
    erros,
    avisos,
    infos,
    ok: erros.length === 0,
  });
}

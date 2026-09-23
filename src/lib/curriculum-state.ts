// curriculum-state.ts — PADRÃO MATERIAL-FIRST do Hub
//
// Fonte única de verdade sobre "o que a turma JÁ VIU em sala".
//
// COMO FUNCIONA (o padrão que o site inteiro segue):
//   1. Um material novo chega → entra em `materials` (course-data.ts).
//   2. Você anota nele `topicosCobertos: [unidades do conteudoProgramatico]`
//      que aquele material COMPROVA terem sido dados em aula.
//   3. Pronto: Praticar, Simulado, estatísticas de alinhamento e o banner
//      "no ritmo da turma" se adaptam sozinhos — sem tocar em mais nada.
//
// Regras de honestidade (política do app):
//   - Material de ementa/plano/apoio (ementa, calendar, monitoria) NÃO marca
//     unidade como coberta — só conteúdo de aula real (slides, listas, provas,
//     questões semanais, exemplos, vídeos da disciplina).
//   - Unidade sem nenhum material comprobatório = "adiantado": o exercício
//     existe no acervo, mas fica fora do ritmo padrão até a aula acontecer.
//   - NADA é apagado: o aluno pode ativar "mostrar conteúdos futuros" quando
//     quiser se adiantar. É foco, não censura.

import { materials, getDisciplineByCode, type Material } from '@/data/course-data';
import { exercises as EXERCISE_CACHE, type Exercise } from '@/lib/exercise-extractor';

/** Estágio de um exercício em relação ao estado atual da turma. */
export type ExerciseStage = 'em_sala' | 'adiantado';

/** Materiais que NÃO comprovam conteúdo dado em aula (apoio, plano, agenda). */
const NAO_COMPROVA_AULA = new Set(['ementa', 'calendar', 'web_page_apoio']);

function materialComprovaAula(m: Material): boolean {
  if (NAO_COMPROVA_AULA.has(m.type)) return false;
  return (m.topicosCobertos?.length ?? 0) > 0;
}

/**
 * Unidades do conteudoProgramatico já dadas em sala, por disciplina.
 * Derivado 100% dos `topicosCobertos` dos materiais — nunca hard-coded aqui.
 */
export function getCoveredUnits(disciplineCode: string): Set<string> {
  const covered = new Set<string>();
  for (const m of materials) {
    if (m.disciplineCode !== disciplineCode) continue;
    if (!materialComprovaAula(m)) continue;
    for (const u of m.topicosCobertos ?? []) covered.add(u);
  }
  return covered;
}

/** Unidades programáticas completas de uma disciplina (ordem do PPC). */
export function getUnitsOf(disciplineCode: string): string[] {
  const d = getDisciplineByCode(disciplineCode);
  return d ? d.conteudoProgramatico.map((u) => u.unidade) : [];
}

/**
 * GATE FINO: sub-tópicos específicos (dentro de uma unidade) já comprovados
 * por materiais reais via `topicosCobertosFino`. Ex.: o professor deu
 * "sistemas lineares" dentro da unidade 1 → um material novo registra
 * topicosCobertosFino: ['Sistemas Lineares'] e os exercícios com
 * `requiresSubtopico` se liberam sozinhos — sem editar código.
 */
export function getCoveredSubtopicos(disciplineCode: string): Set<string> {
  const covered = new Set<string>();
  for (const m of materials) {
    if (m.disciplineCode !== disciplineCode) continue;
    if (!materialComprovaAula(m)) continue;
    for (const s of m.topicosCobertosFino ?? []) covered.add(s);
  }
  return covered;
}

/** A disciplina já comprovou (por material real) este sub-tópico fino? */
export function disciplineCoversSubtopico(disciplineCode: string, subtopico: string): boolean {
  return getCoveredSubtopicos(disciplineCode).has(subtopico);
}

/** Estágio de um exercício: o tópico dele já foi dado em sala? */
export function getExerciseStage(ex: Exercise): ExerciseStage {
  const covered = getCoveredUnits(ex.disciplineCode);
  // Sem campo `unit` (ex.: prova real antiga sem mapeamento) → assume em sala
  // para não esconder conteúdo real do aluno.
  if (!ex.unit) return 'em_sala';
  if (!covered.has(ex.unit)) return 'adiantado';
  // Unidade coberta, mas o exercício exige um sub-tópico fino ainda não
  // comprovado por material real (ex.: sistemas lineares) → segue "adiantado".
  if (ex.requiresSubtopico && !disciplineCoversSubtopico(ex.disciplineCode, ex.requiresSubtopico))
    return 'adiantado';
  return 'em_sala';
}

/** Divide o acervo em "no ritmo da turma" e "adiantado" (com estágio em cada). */
export function alignExercises(list: Exercise[]): Array<Exercise & { stage: ExerciseStage }> {
  return list.map((ex) => ({ ...ex, stage: getExerciseStage(ex) }));
}

export interface AlignmentStats {
  emSala: number;
  adiantado: number;
  total: number;
}

/** Estatísticas globais de alinhamento (acervo inteiro). */
export function getAlignmentStats(): AlignmentStats {
  let emSala = 0;
  let adiantado = 0;
  for (const ex of EXERCISE_CACHE) {
    if (getExerciseStage(ex) === 'em_sala') emSala += 1;
    else adiantado += 1;
  }
  return { emSala, adiantado, total: emSala + adiantado };
}

/** Estatísticas de alinhamento por disciplina. */
export function getAlignmentStatsByDiscipline(code: string): AlignmentStats {
  let emSala = 0;
  let adiantado = 0;
  for (const ex of EXERCISE_CACHE) {
    if (ex.disciplineCode !== code) continue;
    if (getExerciseStage(ex) === 'em_sala') emSala += 1;
    else adiantado += 1;
  }
  return { emSala, adiantado, total: emSala + adiantado };
}

/** Resumo legível do estado da turma (para banners e o tutor). */
export function describeClassState(disciplineCode: string): string {
  const d = getDisciplineByCode(disciplineCode);
  if (!d) return '';
  const covered = getCoveredUnits(disciplineCode);
  const all = getUnitsOf(disciplineCode);
  const nextUnit = all.find((u) => !covered.has(u));
  const coveredNames = all.filter((u) => covered.has(u));
  const parts: string[] = [];
  if (coveredNames.length > 0) {
    parts.push(`Já visto em sala: ${coveredNames.join(', ')}`);
  }
  if (nextUnit) parts.push(`Próximo no plano: ${nextUnit}`);
  return parts.join(' · ');
}


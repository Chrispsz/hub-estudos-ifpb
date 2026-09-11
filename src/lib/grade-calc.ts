// Lógica de cálculo de médias por disciplina
import type { Discipline, GradeComponent } from '@/data/course-data';

export interface GradeResult {
  ms: number | null; // média do semestre (escala da disciplina)
  status: 'aprovado' | 'final' | 'reprovado' | 'incompleto';
  needsFinal: boolean;
  mf: number | null; // média final (com AF)
  af: number | null;
  scale: 10 | 100;
}

/** Nota preenchida e numérica — undefined/null/NaN não entram no cálculo. */
function isFilledNote(note: number | undefined): note is number {
  return note != null && !Number.isNaN(note);
}

/**
 * Calcula a média do semestre (MS) usando os pesos dos componentes.
 * Trata escala: se escala for 10, normaliza para 100 para comparação com thresholds.
 */
export function calcGrade(
  discipline: Discipline,
  notes: { [componentName: string]: number },
  af?: number,
): GradeResult {
  const scale = discipline.scale;
  const threshold = discipline.approvalThreshold;
  const finalThreshold = discipline.finalExamThreshold ?? 0;
  const components = discipline.gradeComponents;

  // Verifica se todos os componentes foram preenchidos
  const filledComponents = components.filter((c) => isFilledNote(notes[c.name]));
  if (filledComponents.length === 0) {
    return {
      ms: null,
      status: 'incompleto',
      needsFinal: false,
      mf: null,
      af: null,
      scale,
    };
  }

  // Calcula MS como soma ponderada (peso em %).
  // Preenchimento parcial: mantém o cálculo proporcional ao que já existe
  // (não penaliza componentes ainda sem nota).
  let totalWeight = 0;
  let weightedSum = 0;
  for (const c of components) {
    const note = notes[c.name];
    if (!isFilledNote(note)) continue;
    // Normaliza para 100 se escala for 10
    const normalized = scale === 10 ? note * 10 : note;
    weightedSum += normalized * c.weight;
    totalWeight += c.weight;
  }

  if (totalWeight === 0) {
    return {
      ms: null,
      status: 'incompleto',
      needsFinal: false,
      mf: null,
      af: null,
      scale,
    };
  }

  // MS em escala 0-100
  const ms100 = weightedSum / totalWeight;

  // Converte de volta para escala da disciplina
  const ms = scale === 10 ? ms100 / 10 : ms100;

  // Determina status
  let status: GradeResult['status'] = 'aprovado';
  let needsFinal = false;
  if (ms100 >= threshold) {
    status = 'aprovado';
  } else if (ms100 < finalThreshold) {
    status = 'reprovado';
  } else {
    status = 'final';
    needsFinal = true;
  }

  // Se AF fornecida, calcula MF = (6*MS + 4*AF)/10 (fórmula padrão IFPB)
  let mf: number | null = null;
  let afNormalized: number | null = null;
  if (needsFinal && af != null && !Number.isNaN(af)) {
    afNormalized = scale === 10 ? af * 10 : af;
    // MF = (6*MS + 4*AF)/10 — em escala 0-100
    const mf100 = (6 * ms100 + 4 * afNormalized) / 10;
    mf = scale === 10 ? mf100 / 10 : mf100;
    // Limiar de aprovação pós-final: MF ≥ 5,0 (escala 10) ou MF ≥ 50 (escala 100).
    // mf100 está SEMPRE em 0-100 → para escala 10 o limiar em mf100 é 50 (= MF 5,0).
    // Fix do bug latente encontrado na R07: comparava com 5 (= MF 0,5, aprovava errado).
    // Afeta apenas disciplinas com escala 10 (ex.: RHT, Inglês/Português Instrumental).
    status = mf100 >= 50 ? 'aprovado' : 'reprovado';
  }

  return {
    ms,
    status,
    needsFinal,
    mf,
    af: afNormalized,
    scale,
  };
}

export function statusLabel(result: GradeResult): string {
  if (result.status === 'incompleto') return 'Preencha as notas';
  if (result.status === 'aprovado') return result.mf != null ? 'Aprovado na final' : 'Aprovado por média';
  if (result.status === 'final') return 'Fazer avaliação final';
  if (result.status === 'reprovado') return 'Reprovado';
  return '—';
}

export function statusColor(result: GradeResult): string {
  if (result.status === 'incompleto') return 'text-muted-foreground';
  if (result.status === 'aprovado') return 'text-emerald-700';
  if (result.status === 'final') return 'text-amber-700';
  if (result.status === 'reprovado') return 'text-rose-700';
  return 'text-muted-foreground';
}

export function formatNote(value: number | null, _scale: 10 | 100): string {
  if (value == null) return '—';
  // 1 casa decimal nas duas escalas (ex.: 7,0 na escala 10; 70,0 na escala 100).
  const decimals = 1;
  return value.toFixed(decimals).replace('.', ',');
}

export function getComponentMax(c: GradeComponent): number {
  return c.scale;
}

export function getComponentStep(c: GradeComponent): number {
  return c.scale === 10 ? 0.1 : 0.5;
}

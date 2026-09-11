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
  const filledComponents = components.filter((c) => notes[c.name] != null && !Number.isNaN(notes[c.name]));
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

  // Calcula MS como soma ponderada (peso em %)
  let totalWeight = 0;
  let weightedSum = 0;
  let hasPartial = false;
  for (const c of components) {
    const note = notes[c.name];
    if (note == null || Number.isNaN(note)) {
      hasPartial = true;
      continue;
    }
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
  let ms100 = weightedSum / totalWeight;

  // Se preenchimento parcial, calcula proporcional ao que já tem (não penaliza o que falta)
  // Mas marca como parcial
  if (hasPartial) {
    // mantém cálculo proporcional
  }

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
    status = mf100 >= (scale === 10 ? 5 : 50) ? 'aprovado' : 'reprovado';
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

export function formatNote(value: number | null, scale: 10 | 100): string {
  if (value == null) return '—';
  const decimals = scale === 10 ? 1 : 1;
  return value.toFixed(decimals).replace('.', ',');
}

export function getComponentMax(c: GradeComponent): number {
  return c.scale;
}

export function getComponentStep(c: GradeComponent): number {
  return c.scale === 10 ? 0.1 : 0.5;
}

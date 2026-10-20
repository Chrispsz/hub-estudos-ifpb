/**
 * Inteligência da Prova 1 de Algoritmos — matemática da recorrência
 * ------------------------------------------------------------------
 * t241 — mineração das 10 provas do prof. Fábio (2020.1–2022.1, 9 únicas,
 * 41 questões) + as 7 listas semanais. A descoberta central: o professor
 * RECICLA (2021.1_av1 = 4/5 reutilizado; 2022.1_av1 = 2/3) e as Questões
 * da Semana são o mesmo pool da prova. Logo, a melhor previsão não é um
 * palpite — é a frequência medida.
 *
 * A casa aqui é DATa-ONLY: nenhum card novo, nenhuma aba. Os pesos ordenam
 * a fila do Praticar via preset do Simulado (1 fácil / 1 média / 1 difícil,
 * o formato REAL confirmado da prova) e o trio se refaz toda semana
 * (seed = semana), igual ao cronograma da casa: nada fixo.
 */
import { exercises, type Exercise } from './exercise-extractor';

export const ALG_EXAM = {
  disciplineCode: 'TEC.1687',
  disciplineShort: 'Algoritmos',
  name: 'Prova 1',
  date: '2026-10-30',
  /** O formato REAL, confirmado pelo professor. */
  format: '3 questões — 1 fácil, 1 média, 1 difícil',
  /** A fonte REAL, confirmada pelo dono: as 7 listas da semana. */
  scope: 'Questões da Semana 1–7 (U1–U3: entrada/saída, condicionais, repetição)',
} as const;

/**
 * Peso de recorrência por FAMÍLIA temática — contagem de aparições nas
 * 9 provas únicas (2020–2022) somada à presença nas 7 listas. Quanto maior,
 * mais provável a família render a questão da próxima prova.
 */
export const ALG_FAMILY_WEIGHTS: Record<string, number> = {
  // famílias do escopo da Prova 1 (U1–U3)
  'Comandos de repetição': 9, // MMC×3, caixa×2, palíndromo, primos, PA, dígitos×5, séries
  'Comandos de entrada e saída': 4, // conta restaurante, IMC, segundos→hms (esquenta)
  'Desvios condicionais': 4, // IMC, supressão de zeros, faixas
  'Strings': 3, // strlen/strcpy manuais (S7) + palíndromo de vetor
  // famílias das provas 2 e 3 (pesam no semestre todo)
  'Vetores e matrizes': 8, // a família mais batida (6 provas)
  'Modularização de programas': 6, // subprograma obrigatório é a direção nova
  'Recursividade': 5, // AV3s 100% recursivas
};

const SCOPE_UNITS = ['Unidade 1:', 'Unidade 2:', 'Unidade 3:'];

/** RNG determinístico (mulberry32) — o trio muda toda semana, mas é estável dentro dela. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface AlgTrio {
  facil: Exercise;
  medio: Exercise;
  dificil: Exercise;
}

function poolOf(difficulty: Exercise['difficulty'], exclude: Set<string>): { ex: Exercise; score: number }[] {
  return exercises
    .filter(
      (e) =>
        e.disciplineCode === ALG_EXAM.disciplineCode &&
        e.difficulty === difficulty &&
        !exclude.has(e.id),
    )
    .map((e) => {
      // no escopo da Prova 1 as questões de U1–U3 valem mais; prova_real soma
      // (é literalmente o gabarito do que costuma cair); família recorrente soma.
      const inScope = SCOPE_UNITS.some((u) => e.unit?.startsWith(u)) ? 3 : 0;
      const family = ALG_FAMILY_WEIGHTS[e.topic] ?? 1;
      const real = e.source === 'prova_real' ? 2.5 : 0;
      const mirror = e.source === 'material_professor' ? 1.5 : 0;
      return { ex: e, score: inScope + family + real + mirror };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * O trio da semana no formato da prova: 1 fácil + 1 média + 1 difícil,
 * priorizando (1) escopo da prova, (2) famílias que mais caem,
 * (3) questões de prova real / da Semana 7. `seed` = semana → refaz semanal.
 */
export function algProva1Trio(seed: number): AlgTrio | null {
  const rng = mulberry32(seed);
  const used = new Set<string>();
  const pick = (difficulty: Exercise['difficulty']): Exercise | null => {
    const pool = poolOf(difficulty, used);
    if (pool.length === 0) return null;
    // top-4 pelo score, sorteio justo entre eles (variação semanal sem perder foco)
    const shortlist = pool.slice(0, Math.min(4, pool.length));
    return shortlist[Math.floor(rng() * shortlist.length)].ex;
  };
  const facil = pick('facil');
  const medio = pick('medio');
  const dificil = pick('dificil');
  if (!facil || !medio || !dificil) return null;
  used.add(facil.id);
  used.add(medio.id);
  used.add(dificil.id);
  return { facil, medio, dificil };
}

/** Número da semana "atual" (estável 7 dias) — o mesmo relógio do cronograma. */
export function algTrioWeekSeed(now: Date = new Date()): number {
  return Math.floor(now.getTime() / (7 * 24 * 3600 * 1000));
}

/** Frase curta de contexto para as superfícies que citam a prova (hero, radar). */
export function algExamPhrase(): string {
  return `${ALG_EXAM.format} · sai das Semanas 1–7`;
}

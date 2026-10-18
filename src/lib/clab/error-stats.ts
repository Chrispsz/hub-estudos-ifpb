/**
 * Lab de Código — Telemetria local "onde você erra mais"
 * -------------------------------------------------------
 * O dono pediu (áudio 18/10/2026) um acompanhamento de ONDE ele erra mais
 * ("tô errando na escrita, na sintaxe e nas variáveis"). A telemetria é
 * semi-automática e 100% LOCAL: cada execução que falha é categorizada pela
 * mesma régua do diagnóstico (diagnose.ts) e contada no localStorage.
 * NADA é enviado para servidor.
 *
 * Chave: 'clab-error-stats-v1' · shape: { cats: {sintaxe, variavel, ...}, ok }
 *   cats[categoria] → nº de falhas naquela categoria
 *   ok              → nº de execuções completas e limpas (reforço positivo)
 */
import { categorizeClabError, type ErrCategory } from './diagnose';

export const CLAB_ERROR_STATS_KEY = 'clab-error-stats-v1';

export interface ClabErrorStats {
  /** falhas por categoria (mesma régua do diagnóstico). */
  cats: Record<ErrCategory, number>;
  /** execuções completas que terminaram sem erro — o lado bom da régua. */
  ok: number;
}

const EMPTY_CATS: Record<ErrCategory, number> = {
  sintaxe: 0,
  variavel: 0,
  tipo: 0,
  laco: 0,
  io: 0,
  outro: 0,
};

function emptyStats(): ClabErrorStats {
  return { cats: { ...EMPTY_CATS }, ok: 0 };
}

/** Lê o acúmulo de erros/acertos (seguro fora do browser e com storage bloqueado). */
export function readClabErrorStats(): ClabErrorStats {
  if (typeof window === 'undefined') return emptyStats();
  try {
    const raw = window.localStorage.getItem(CLAB_ERROR_STATS_KEY);
    if (!raw) return emptyStats();
    const p = JSON.parse(raw) as Partial<ClabErrorStats>;
    return {
      cats: { ...EMPTY_CATS, ...(p.cats ?? {}) },
      ok: typeof p.ok === 'number' && p.ok >= 0 ? Math.floor(p.ok) : 0,
    };
  } catch {
    return emptyStats();
  }
}

function writeStats(s: ClabErrorStats): void {
  try {
    window.localStorage.setItem(CLAB_ERROR_STATS_KEY, JSON.stringify(s));
  } catch {
    /* storage cheio/bloqueado — segue sem persistir (a sessão ainda mostra) */
  }
}

/** Registra uma execução que falhou; devolve o estado atualizado para a UI. */
export function recordClabError(message: string): ClabErrorStats {
  const s = readClabErrorStats();
  const cat = categorizeClabError(message);
  s.cats[cat] += 1;
  writeStats(s);
  return s;
}

/** Registra uma execução completa e limpa; devolve o estado atualizado. */
export function recordClabSuccess(): ClabErrorStats {
  const s = readClabErrorStats();
  s.ok += 1;
  writeStats(s);
  return s;
}

/** Zera a contagem (o dado é do dono — tem que ter volta). */
export function resetClabErrorStats(): ClabErrorStats {
  const fresh = emptyStats();
  writeStats(fresh);
  return fresh;
}

/** Total de falhas acumulado (todas as categorias). */
export function totalClabErrors(s: ClabErrorStats): number {
  return Object.values(s.cats).reduce((acc, n) => acc + n, 0);
}

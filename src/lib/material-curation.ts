// material-curation.ts — A CURADORIA CASO A CASO (pedido do dono, 12/10/2026:
// "analisar caso a caso o material com o estado da matéria e remover ou tirar
// atenção do que não vai gerar produtividade e aprendizado real — priorizar
// os com questões práticas/material real; leitura fica complementar; o que
// foi gerado pra prova não precisa mais; programação é cumulativa — uma coisa
// leva a outra —, matemática por tópico: o que passou não volta a menos que
// outro tópico precise").
//
// Três decisões que a casa toma daqui pra frente, TODAS com o porquê escrito:
//   1. PAPEL (role) — o que este material É:
//      pratica  → tem questões/código para resolver (o que fixa de verdade);
//      leitura  → faz parte do assunto, serve como leitura/complemento;
//      apoio    → consulta/institucional (ementa, calendário, link, PNAAT);
//      arquivo  → gerado para uma prova que JÁ PASSOU (fora da fila; fica
//                 como consulta — a casa não apaga, deixa de oferecer).
//   2. FILA (evidence + tier) — a ordem de quem ainda não foi estudado:
//      a evidência mais RECENTE da aula primeiro (as semanas do Classroom),
//      prática antes de leitura no mesmo nível, e o ACERVO-ESPARSO (material
//      que cobre 3+ unidades — o muro de 43 páginas, a pasta do Drive, os
//      slides gerais) vai pro FIM como aquecimento: "ainda posso praticá-los
//      para ficar com a mente aquecida" (o dono) — útil, nunca estrela.
//   3. RETENÇÃO POR DISCIPLINA — como o antigo volta:
//      cumulativa  (Algoritmos): tudo aquece — padrão se aprende revisitando;
//      por-tópico  (Matemática): tópico encerrado não reaparece por si só.
//
// Lib PURA: recebe Material, devolve decisão. Nada lê storage, nada importa
// React — o plano, a biblioteca e as auditorias chamam a mesma régua.

import { materials, type Material } from '@/data/course-data';

export type MaterialRole = 'pratica' | 'leitura' | 'apoio' | 'arquivo';

export interface CurationDecision {
  role: MaterialRole;
  /** O porquê da decisão — caso a caso, em uma linha (a voz da casa). */
  note: string;
  /** true = acervo-esparso (3+ unidades ou marcado) — aquecimento, fim da fila. */
  warmup: boolean;
  /** true = entra na fila de estudo (pratica/leitura sem ser warmup-último). */
  queueable: boolean;
}

/** Política de retenção do antigo, por disciplina (a doutrina do dono). */
export const DISCIPLINE_POLICY: Record<
  string,
  { retention: 'cumulativa' | 'por-topico'; note: string }
> = {
  'TEC.1687': {
    retention: 'cumulativa',
    note: 'algoritmo é prática: uma coisa leva a outra — o acervo inteiro aquece e ensina padrão',
  },
  'TEC.1984': {
    retention: 'por-topico',
    note: 'matemática por tópico: o que passou não volta por si só — só quando outro tópico precisar dele',
  },
};

/** Fallback honesto para material futuro sem decisão explícita. */
function roleByType(m: Material): MaterialRole {
  if (m.disciplineCode === 'PNAAT') return 'apoio';
  if (m.type === 'lista_exercicios' || m.type === 'exemplo') return 'pratica';
  if (m.type === 'web_page' || m.type === 'ementa' || m.type === 'calendar') return 'apoio';
  return 'leitura';
}

// ----- A curadoria caso a caso (id → decisão) -----
// Cada entrada é UMA avaliação real do acervo (dono + casa, 12/10/2026).
// O fallback por tipo cobre o resto do acervo e o material futuro.
const DECISIONS: Record<string, { role: MaterialRole; note: string; warmup?: boolean }> = {
  // ---------- TEC.1687 · Algoritmos (cumulativa) ----------
  'alg-lista': {
    role: 'pratica',
    warmup: true,
    note: 'muro de 43 páginas com o acervo inteiro — as questões frescas da semana vêm antes; aqui é aquecimento',
  },
  'alg-videoaulas': {
    role: 'leitura',
    warmup: true,
    note: 'pasta do Drive com tudo — vídeo é passivo e velho; quem tem questões frescas não começa pelo Drive',
  },
  'alg-slides-geral': {
    role: 'leitura',
    warmup: true,
    note: 'slides gerais das 3 unidades — referência de consulta, não o passo seguinte',
  },
  'alg-questoes-semana1': { role: 'pratica', note: 'questões reais da aula (09/09) — prática vale mais que leitura' },
  'alg-questoes-semana2': { role: 'pratica', note: 'questões reais (17/09, já pegando repetição) — a frente da aula' },
  'alg-questoes-semana3': { role: 'pratica', note: 'questões reais (23/09) — a evidência mais nova da aula' },
  'alg-questoes-semana4': { role: 'pratica', note: 'questões reais mais recentes da aula — o estado da matéria' },
  'alg-programas-c-autorais': { role: 'pratica', note: '19 programas resolvidos do autor — espelho pra conferir o próprio C' },
  'alg-tipos-operadores': { role: 'leitura', note: 'slides da Unidade 1 — leitura de base, complementar às questões' },
  'alg-monitoria-discord': { role: 'apoio', note: 'link de monitoria — apoio, não conteúdo de fila' },
  'alg-ementa': { role: 'apoio', note: 'plano de disciplina — consulta' },

  // ---------- TEC.1984 · Matemática (por-tópico) ----------
  'mat-av1-questoes-professor': {
    role: 'arquivo',
    note: 'espelhos das listas gerados PARA a Av1 — a prova passou, as listas originais ficam (dono: "gerado pra prova nem precisa mais")',
  },
  'mat-logica-slides': { role: 'leitura', note: 'teoria da lógica — leitura complementar às listas' },
  'mat-logica-lista': { role: 'pratica', note: 'lista real de lógica — o que fixa é resolver' },
  'mat-00-matrizes': { role: 'leitura', note: 'slides da aula de matrizes — leitura do assunto em curso' },
  'mat-01-matrizes': { role: 'pratica', note: 'lista da aula mais recente de matemática — a evidência viva' },
  'mat-ementa': { role: 'apoio', note: 'plano de disciplina — consulta' },

  // ---------- TEC.1632 · Linguagem de Marcação ----------
  'lm-exemplo-formularios': {
    role: 'pratica',
    note: 'index.html da aula que renderiza ao vivo — material real para mexer, quebrar e refazer',
  },
  'lm-html-06-formularios': { role: 'leitura', note: 'slides do assunto mais recente (formulários) — leitura guiada' },
  'lm-html-07-metadados': { role: 'leitura', note: 'slides do assunto mais recente (metadados) — leitura guiada' },
  'lm-html-03-hyperlinks': { role: 'leitura', note: 'slides de hyperlinks — leitura do assunto dado' },
  'lm-html-04-midias': { role: 'leitura', note: 'slides de mídias — leitura do assunto dado' },
  'lm-web-tabelas': { role: 'leitura', note: 'aula 05 (17/09) na apostila — leitura do assunto dado; tabela é para DADOS, nunca layout' },
  'lm-web-css-seletores': {
    role: 'leitura',
    note: 'aula 08 (01/10) — PRIMEIRO CSS, base da A2 (45% da nota): intro + os 8 tipos de seletor da apostila',
  },
  'lm-01-estrutura': { role: 'leitura', note: 'slides da estrutura do HTML — leitura de base' },
  'lm-intro-00': { role: 'leitura', note: 'introdução da disciplina — leitura de base' },
  'lm-listas-slides': { role: 'leitura', note: 'slides de listas — leitura do assunto dado' },
  'lm-ementa': { role: 'apoio', note: 'plano de disciplina — consulta' },
  // (os web_page da apostila LM caem no fallback: apoio)

  // ---------- 53647 · Fundamentos ----------
  'prova-fund-av1': {
    role: 'arquivo',
    note: 'a prova da Av1 transcrita — consulta e espelho de questões; a fila não oferece mais (a prova passou)',
  },
  'fund-01-notacoes-numericas': { role: 'leitura', note: 'notações numéricas — leitura do assunto dado' },
  'fund-02-historia-computacao': { role: 'leitura', note: 'história/hardware — leitura do assunto dado' },
  'fund-ementa': { role: 'apoio', note: 'plano de disciplina — consulta' },

  // ---------- TEC.0953 · RHT ----------
  'rht-teletrabalho-serpro': {
    role: 'leitura',
    note: 'artigo com proposta de atividade — leitura com produto (a atividade I vale resolver)',
  },
  'rht-ementa': { role: 'apoio', note: 'plano de disciplina — consulta' },

  // ---------- ING.001 / PORT.001 ----------
  'ing-vocabulario': { role: 'leitura', note: 'vocabulário do semestre — leitura de manutenção' },
  'ing-video-corpo-verbos': { role: 'leitura', note: 'vídeo curto (16 min) — complemento, nunca o passo seguinte' },
  'ing-ementa': { role: 'apoio', note: 'plano de disciplina — consulta' },
  'port-ementa': { role: 'apoio', note: 'material da Português é FÍSICO — a ementa é a âncora da consulta' },

  // ---------- PNAAT (institucional — o curso vive na plataforma FIT) ----------
  'pnaat-cursos': {
    role: 'apoio',
    note: 'o curso PNAAT roda na FIT (externo) — a casa lembra pelo card, não enfileira PDF institucional',
  },
  // (os demais PNAAT caem no fallback: apoio)
};

/** Toda decisão computada uma única vez (o acervo é estático). */
const COMPUTED = new Map<string, CurationDecision>();

function decide(m: Material): CurationDecision {
  const cached = COMPUTED.get(m.id);
  if (cached) return cached;

  const explicit = DECISIONS[m.id];
  const role = explicit?.role ?? roleByType(m);
  // acervo-esparso: material que cobre 3+ unidades é acervo, não "aula de hoje"
  const coversUnits = m.topicosCobertos?.length ?? 0;
  const warmup = explicit?.warmup ?? coversUnits >= 3;
  const queueable = role === 'pratica' || role === 'leitura';
  const decision: CurationDecision = {
    role,
    note: explicit?.note ?? `classificado como ${role} pelo tipo (${m.type})`,
    warmup: queueable && warmup,
    queueable,
  };
  COMPUTED.set(m.id, decision);
  return decision;
}

export function curateMaterial(m: Material): CurationDecision {
  return decide(m);
}

/** Entra na fila de estudo? (prática/leitura sim; apoio/arquivo nunca) */
export function inStudyQueue(m: Material): boolean {
  return decide(m).queueable;
}

// ----- A ordem da fila: evidência da aula, prática antes, acervo no fim -----

/** A cronologia real das aulas (Classroom 09/09 → hoje) — explícita porque o
 * array do acervo não carrega data. Sem marcação = arrayIndex (o acervo é
 * montado na ordem da aula; dentro da mesma disciplina, mais adiante = mais novo). */
const EVIDENCE: Record<string, number> = {
  'alg-questoes-semana1': 10,
  'alg-programas-c-autorais': 12,
  'alg-questoes-semana2': 25,
  'alg-questoes-semana3': 30,
  'alg-questoes-semana4': 40,
  'mat-01-matrizes': 40, // aula 01 — a evidência mais nova de matemática
  'mat-00-matrizes': 35,
  'mat-logica-lista': 20,
  'mat-logica-slides': 15,
};

const ARRAY_INDEX = new Map(materials.map((m, i) => [m.id, i]));

/**
 * O RANK de estudo do material — quanto MENOR, mais perto de "próximo da fila".
 *   0–999: prática do assunto em curso (evidência recente primeiro)
 * 1000–…: leitura do assunto em curso
 * 2000–…: aquecimento (acervo-esparso) — o fim honesto da fila
 */
export function studyRank(m: Material): number {
  const d = decide(m);
  if (!d.queueable) return Number.POSITIVE_INFINITY;
  const evidence = EVIDENCE[m.id] ?? ARRAY_INDEX.get(m.id) ?? 0;
  const base = d.warmup ? 2000 : d.role === 'pratica' ? 0 : 1000;
  // dentro do mesmo papel: a evidência MAIS NOVA vem primeiro
  return base + 1000 - Math.min(999, evidence);
}

/** Frase de retenção do antigo para a disciplina (a doutrina do dono). */
export function retentionNote(disciplineCode: string): string | null {
  return DISCIPLINE_POLICY[disciplineCode]?.note ?? null;
}

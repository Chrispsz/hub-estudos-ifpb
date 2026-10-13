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
  'alg-questoes-semana5': {
    role: 'pratica',
    note: 'questões reais da Unidade 3 NO DEGRAU DA BASE (laço simples: contador, acumulador, string caractere a caractere) — a escadinha da repetição começa aqui',
  },
  'alg-questoes-semana6': {
    role: 'pratica',
    note: 'questões reais no DEGRAU DE CIMA (aninhamento: Fibonacci, palíndromos, figuras) — só sobe com a base da S5 firme (dono: "é uma escadinha")',
  },
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
  'mat-01-matrizes': {
    role: 'pratica',
    note: 'lista da aula de matrizes — o degrau ANTERIOR de determinantes (cofator apaga linha/coluna de matriz: sem matriz firme, sem det)',
  },
  'mat-determinantes-teoria': {
    role: 'leitura',
    note: 'teoria do assunto VIVO (14 propriedades, prof. Eudes) — a leitura que desbloqueia a lista questão por questão',
  },
  'mat-determinantes-lista': {
    role: 'pratica',
    note: 'a prática viva de matemática: 20 questões de determinantes em rampa (Sarrus → propriedades → Vandermonde/Binet) — o que a próxima prova vai cobrar',
  },
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
  'lm-atividade-individual': {
    role: 'pratica',
    note: 'ATIVIDADE VALE NOTA: site pessoal em HTML puro (4 páginas, zero CSS, W3C válido) — a entrega real da disciplina; o retorno prático de todo o HTML dado',
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
  'alg-questoes-semana5': 50, // a evidência viva da Unidade 3 (dada agora)
  'alg-questoes-semana6': 60, // ainda mais nova — mas a escadinha põe a S5 antes (LADDER)
  'mat-01-matrizes': 40, // aula 01 — o degrau anterior do assunto vivo
  'mat-00-matrizes': 35,
  'mat-logica-lista': 20,
  'mat-logica-slides': 15,
  'mat-determinantes-teoria': 45, // o assunto novo da aula (depois de matrizes)
  'mat-determinantes-lista': 55, // a prática viva de matemática AGORA
  'lm-atividade-individual': 50, // a entrega real e datada de LM
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

// ----- A ESCADINHA (dono, 13/10/2026: "em algoritmos a depender do assunto
// pode ser bom iniciar da base pois é uma escadinha") -----
//
// Nem tudo na fila é plano: alguns conteúdos SE APOIAM em outros. A S6 de
// algoritmos (aninhamento) é a S5 (laço simples) + um laço dentro do outro —
// começar por ela sem a base é despenca garantida. A escadinha registra esses
// APOIOS explícitos e a fila obedece: um degrau nunca é oferecido antes da
// base pendente — a base toma o lugar dele na fila, e o porquê é dito.
//
// Regras da casa:
//   • a escadinha é POR MATERIAL (não por disciplina) — a S4 de condicionais
//     não pede a S3 como base: são paralelas; a S6 pede a S5: é degrau.
//   • concluiu o degrau? a escada some — o material novo volta a ser o
//     "próximo" natural (a régua da evidência manda de novo).
//   • a matemática entra na escada no eixo TEORIA → LISTA (a lista de
//     determinantes apoiada na teoria da mesma aula), e o degrau anterior do
//     tópico (matrizes) é reaquecimento — por-tópico, o que passou não volta
//     por si só; volta quando o tópico novo PRECISA dele.

const BY_ID = new Map(materials.map((m) => [m.id, m]));

export interface LadderRung {
  /** O degrau anterior — a base da qual este material se apoia. */
  prev: string;
  /** O porquê do apoio, em uma linha (a voz da casa). */
  note: string;
}

/** Os degraus conhecidos: material → base dele. */
export const LADDER: Record<string, LadderRung> = {
  'alg-questoes-semana6': {
    prev: 'alg-questoes-semana5',
    note: 'aninhamento é a S5 + um laço dentro do outro — sem o degrau da base (contador, acumulador), a figura do asterisco despenca',
  },
  'mat-determinantes-lista': {
    prev: 'mat-determinantes-teoria',
    note: 'a lista usa as 14 propriedades — a teoria da aula mapeia 1:1 com as questões (Q8–Q10 são P3/P5/P6/P9; Q17–Q19 são P14)',
  },
};

/** O degrau anterior deste material — null quando ele não é um degrau. */
export function ladderPrev(materialId: string): string | null {
  return LADDER[materialId]?.prev ?? null;
}

/** O porquê do apoio deste material — null quando não há escada. */
export function ladderNote(materialId: string): string | null {
  return LADDER[materialId]?.note ?? null;
}

/** O material do degrau anterior (resolvido do acervo) — null se não existe. */
export function ladderPrevMaterial(materialId: string): Material | null {
  const prevId = ladderPrev(materialId);
  return prevId ? BY_ID.get(prevId) ?? null : null;
}

/**
 * A ESCADINHA aplicada à fila: recebe a fila já ranqueada (studyRank) e os ids
 * ainda PENDENTES, e devolve a fila reordenada onde NENHUM degrau aparece
 * antes da base pendente dele — a base toma o lugar na frente.
 * Também devolve `whyOverride`: quando um material entrou na frente POR SER
 * base de outro, o porquê da fila explica a escadinha (o plano diz e ensina).
 * Lib pura: nada lê storage; concluiu a base? a escada some sozinha.
 */
export function applyLadder(
  queue: Material[],
  pendingIds: Set<string>,
): { queue: Material[]; whyOverride: Map<string, string> } {
  const whyOverride = new Map<string, string>();
  const seen = new Set<string>();
  const out: Material[] = [];

  for (const m of queue) {
    if (seen.has(m.id)) continue;
    // sobe a escada a partir de m até a base mais alta pendente (teto de 4
    // degraus: o acervo é curto; laço infinito aqui é vergonha dobrada)
    const chain: Material[] = [m];
    let current = m;
    for (let hops = 0; hops < 4; hops++) {
      const prevId = ladderPrev(current.id);
      if (!prevId || seen.has(prevId) || !pendingIds.has(prevId)) break;
      const prev = BY_ID.get(prevId);
      if (!prev) break;
      chain.push(prev);
      current = prev;
    }
    // desce empilhando do degrau mais alto ao mais baixo: a BASE entra na
    // frente (no lugar do degrau) e o degrau de cima vem logo depois
    for (let i = chain.length - 1; i >= 0; i--) {
      const rung = chain[i];
      if (seen.has(rung.id)) continue;
      out.push(rung);
      seen.add(rung.id);
      const above = chain[i - 1];
      if (above) {
        whyOverride.set(
          rung.id,
          `escadinha: é a base de "${above.title}" — ${ladderNote(above.id) ?? 'a base vem antes'}`,
        );
      }
    }
  }

  return { queue: out, whyOverride };
}

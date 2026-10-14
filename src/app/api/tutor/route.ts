// /api/tutor — Tutor IA + gerador de flashcards
//
// Cadeia de provedores (primeiro disponível responde) — 100% REST puro, sem
// NENHUM SDK proprietário: roda igual em qualquer servidor/Vercel e usa as
// MESMAS Environment Variables já configuradas no deploy (nada reconfigurar):
//
//  1º Google Gemini (chave SALVA na casa — dado do dono no banco, Task 214,
//     lida a CADA requisição via getEffectiveGeminiConfig(); sem chave salva,
//     cai para a env GEMINI_API_KEY/GOOGLE_AI_API_KEY)
//                                          — RECOMENDADO: key grátis no AI Studio
//                                            (aistudio.google.com/app/apikey, sem cartão),
//                                            tier grátis com VISÃO nativa + forte em matemática/LaTeX.
//                                            Resolve texto E leitura de print na Vercel.
//  2º OpenRouter (se OPENROUTER_API_KEY)   — 1 key grátis → dezenas de modelos free (texto + visão)
//  3º Z.ai público (se ZAI_API_KEY)        — API oficial api.z.ai (ex.: glm-4.5-flash, tem tier grátis)
//  4º SDK local (z-ai-web-dev-sdk)         — último elo: usa as credenciais DO PRÓPRIO AMBIENTE de
//                                            execução (config .z-ai-config do sandbox/servidor).
//                                            É o que mantém o tutor VIVO aqui sem nenhuma key; num
//                                            deploy externo sem config, create() falha e a cadeia
//                                            termina no erro honesto de chave — nada muda na Vercel.
//
// Sem nenhuma key NEM SDK configurado → erro HONESTO para o dono (nada de fallback secreto).
//
// DOUTRINA DO CONTEXTO (diretriz do dono, 10/10/2026):
//   · O servidor CONHECE O CURSO (base institucional: IFPB/Cajazeiras, turma,
//     disciplinas, professores, grade e calendário — buildCourseBaseContext,
//     computada A CADA CHAMADA: prova passada some sozinha, nada congela).
//   · O servidor NÃO SABE nada pessoal do aluno: o estado vivo dele (ritmo,
//     consistência, plano, erros) viaja por chamada via `studentContext`/
//     `hubContext` — é usado na resposta e descartado.
//   · NADA PESSOAL ARMAZENADO: o app v2 envia `persist:false` — a thread de
//     chat dele vive no IndexedDB do dispositivo. Só a casa antiga (/?legacy=1)
//     continua usando a memória do servidor, como sempre usou.
// Modelos OpenRouter free verificados:
//  ✅ nvidia/nemotron-3-super-120b-a12b:free  — melhor qualidade/velocidade p/ tutoria PT-BR
//  ✅ nvidia/nemotron-3-ultra-550b-a55b:free  — 550B, mais profundo (mais lento)
//  ✅ nex-agi/nex-n2.5-pro:free               — JSON limpo, ótimo p/ flashcards
//  ✅ inclusionai/ling-3.0-flash-sante:free   — JSON limpo
//  ✅ cohere/north-mini-code:free             — bom p/ dúvidas de código
//  ✅ openrouter/free                         — roteador automático (rede de segurança)
//  ✅ qwen/qwen3.8-27b:free                   — aceita IMAGEM (catálogo 09/2026)
//  ✅ nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free — aceita IMAGEM
//  ✅ google/gemma-4-26b-a4b-it:free          — aceita IMAGEM
//  ❌ google/gemma-4-31b-it:free              — provider error (removido)
//  ❌ thinkingmachines/inkling:free           — exige harness agentic (removido)

export const runtime = 'nodejs';
// Cadeia Gemini(35s) → OpenRouter(13s+) precisa de teto explícito: o padrão da
// plataforma pode matar a função antes do fallback responder (504 pro usuário).
export const maxDuration = 60;

import { db } from '@/lib/db';
import { getEffectiveGeminiConfig } from '@/lib/ai-settings';
import { buildCourseBaseContext, buildCourseBaseShort } from '@/lib/tutor-course-base';
import { buildMaterialBlock, findBestMaterialForQuestion, findMaterial } from '@/lib/material-retrieval';
import { normalizeMath } from '@/lib/sanitize-latex';
import { contentKnowledgeLines, materialFirstPolicyLines } from '@/data/tutor-knowledge';
import { TUTOR_HISTORY_KEEP } from '@/lib/tutor-history-view';
import ZAI from 'z-ai-web-dev-sdk';
import { readFileSync } from 'fs';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Dados reais do Hub enviados pelo front — o tutor responde a partir deles sem inventar. */
interface HubEvaluation {
  name: string;
  discipline: string;
  date?: string; // dd/mm
  week?: number;
  daysLeft: number;
  description?: string;
}

interface HubEvent {
  name: string;
  date: string; // dd/mm
  daysLeft: number;
}

interface HubStudentStats {
  materialsDone: number;
  materialsTotal: number;
  topicsDone: number;
  topicsTotal: number;
  pomodoroMinutes: number;
  flashcardsDue: number;
  exercisesSolved: number;
  exercisesTotal: number;
}

interface HubContext {
  today?: string;
  week?: number;
  totalWeeks?: number;
  professor?: string;
  professorTitle?: string;
  hours?: number;
  nextEvaluations?: HubEvaluation[];
  upcomingEvents?: HubEvent[];
  studentStats?: HubStudentStats;
  /** Estado ao vivo da semana da Av1 (espelho de HubExamWeek em tutor-context). */
  examWeek?: {
    provaDaysLeft: number;
    planoHoje: {
      titulo: string;
      kind: string;
      minutos: number;
      feitas: number;
      total: number;
    } | null;
    diasAtras: number;
    simuladoDaysLeft: number;
    simulado: {
      pct: number;
      meta: number;
      porTopico: { topico: string; solved: number; total: number; puladas: number }[];
      piorTopico?: string;
      /** Bloco INTEIRO sem tentativa (pulouTudo da 105) — precede o pior respondido. */
      pulouTudo?: string | null;
      /** Recibo do drill do foco (106): a revisão prometida aconteceu? Subiu? */
      treinoDoFoco?: {
        quando: 'hoje' | 'ontem' | 'recente';
        solved: number;
        total: number;
        pct: number | null;
        melhorou: boolean | null;
      } | null;
    } | null;
    travadasCount: number;
  };
}

interface TutorRequestBody {
  question?: string;
  discipline?: string;
  /** Código estável da disciplina (chave do histórico salvo). */
  disciplineCode?: string;
  topic?: string;
  material?: string;
  /** id do material no course-data — liga o retrieval ao PDF/resumo certos. */
  materialId?: string;
  history?: ChatMessage[];
  /** Print/foto anexado (data URL) — transcrita por modelo de visão antes de responder. */
  imageDataUrl?: string;
  /** 'flashcards' → array JSON de {front, back}. 'feynman' → avaliação estruturada da técnica Feynman. */
  mode?: 'tutor' | 'flashcards' | 'feynman';
  /** true → resposta em SSE (eventos delta/final/error). Padrão: JSON. */
  stream?: boolean;
  /** true → tutor socrático: dá pistas antes da solução completa (modo dica). */
  hintMode?: boolean;
  /** Dados do app (professor, datas, progresso) para respostas precisas. */
  hubContext?: HubContext;
  /**
   * Estado ao vivo do aluno ENVIADO PELO APP do cliente nesta chamada (ritmo,
   * consistência, sessão em curso) — o servidor USA na resposta e NÃO ARMAZENA.
   * A camada institucional (IFPB, turma, professores, grade, calendário) mora no
   * servidor (tutor-course-base); aqui vem só o que é pessoal/ao vivo.
   * Cap de 1600 chars no servidor.
   */
  studentContext?: string;
  /**
   * false → o servidor NÃO grava este turno no histórico do servidor (padrão do
   * app v2: a thread vive no IndexedDB do aluno — dados pessoais fora do servidor).
   * Padrão true: casa antiga (/?legacy=1), que sempre usou a memória do servidor.
   */
  persist?: boolean;
}

const MAX_HISTORY = 12; // stateless por sessão — contexto suficiente para continuidade
const MODEL_TIMEOUT_MS = 35_000; // se um modelo demorar >35s, cai para o próximo

/**
 * Cadeia de modelos free — ordem otimizada por modo (testada em 10/09/2026):
 * tutor → qualidade didática em PT-BR | flashcards → saída JSON confiável.
 * Obs.: quando GEMINI_API_KEY existe, Gemini entra ANTES desta cadeia (ver POST).
 */

/** Provedor público da Z.ai (api.z.ai) — OpenAI-compatible. Tier grátis no glm-4.5-flash. */
const ZAI_PUBLIC = {
  get key() { return process.env.ZAI_API_KEY; },
  baseUrl: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4',
  model: process.env.ZAI_MODEL || 'glm-4.5-flash',
};

/**
 * Cadeia de modelos free — ordem otimizada por modo (testada em 10/09/2026):
 * tutor → qualidade didática em PT-BR | flashcards → saída JSON confiável.
 */
const MODEL_CHAIN: Record<'tutor' | 'flashcards' | 'feynman', string[]> = {
  tutor: [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'nex-agi/nex-n2.5-pro:free',
    'openrouter/free',
  ],
  flashcards: [
    'nex-agi/nex-n2.5-pro:free',
    'inclusionai/ling-3.0-flash-sante:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'openrouter/free',
  ],
  // avaliação Feynman: precisa de rigor + markdown estruturado
  feynman: [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nex-agi/nex-n2.5-pro:free',
    'inclusionai/ling-3.0-flash-sante:free',
    'openrouter/free',
  ],
};


/**
 * Google Gemini (AI Studio) — o provedor que resolve TUDO com 1 key grátis:
 * texto (matemática/LaTeX forte) + visão nativa (leitura de prints) — direto via
 * REST, sem SDK, roda perfeito na Vercel. Key grátis em aistudio.google.com.
 *
 * A CHAVE PERFEITA (Task 214): a chave NÃO mora mais aqui (nada de módulo
 * estático lendo env no boot) — a leitura é POR REQUISIÇÃO, async, via
 * getEffectiveGeminiConfig(): chave SALVA pelo dono no banco (dado do usuário,
 * entrada pela UI) → env GEMINI_API_KEY/GOOGLE_AI_API_KEY → sem chave (cadeia
 * segue pro próximo elo). Modelo: preferência salva → env GEMINI_MODEL →
 * aliases "-latest" (acompanham a versão GA disponível para a key; versões
 * fixas gemini-2.5-flash-lite/-flash retornam 404 para keys novas — aliases
 * nunca. flash-lite primeiro: limite free mais generoso; flash é o plano B).
 */
const GEMINI = {
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
};

/** Modelos free da OpenRouter que aceitam IMAGEM (catálogo verificado 09/2026). */
const VISION_CHAIN_OPENROUTER = [
  'qwen/qwen3.8-27b:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'google/gemma-4-26b-a4b-it:free',
];

/** Nome curto e legível para exibir na UI (remove sufixo :free e vendor). */
function prettyModelName(id: string): string {
  const clean = id.replace(':free', '');
  const map: Record<string, string> = {
    'gemini-2.5-flash-lite': 'Gemini 2.5 Flash-Lite',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-flash-lite-latest': 'Gemini Flash-Lite',
    'gemini-flash-latest': 'Gemini Flash',
    'nvidia/nemotron-3-super-120b-a12b': 'Nemotron 3 Super',
    'nvidia/nemotron-3-ultra-550b-a55b': 'Nemotron 3 Ultra',
    'nex-agi/nex-n2.5-pro': 'Nex N2.5 Pro',
    'inclusionai/ling-3.0-flash-sante': 'Ling 3.0 Flash',
    'openrouter/free': 'OpenRouter Auto',
    'qwen/qwen3.8-27b': 'Qwen 3.8 27B (visão)',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning': 'Nemotron 3 Nano Omni (visão)',
    'google/gemma-4-26b-a4b-it': 'Gemma 4 26B (visão)',
  };
  return map[clean] ?? clean.split('/').pop() ?? clean;
}

/** Qual provedor responde a leitura de imagem NESTE deploy (para a UI ser honesta). */
async function visionProviderLabel(): Promise<string | null> {
  const geminiCfg = await getEffectiveGeminiConfig();
  if (geminiCfg.key) {
    return geminiCfg.source === 'db'
      ? 'Gemini (chave salva na casa)'
      : 'Gemini (key grátis do AI Studio)';
  }
  if (process.env.OPENROUTER_API_KEY) return 'OpenRouter (modelos free de visão)';
  if (ZAI_PUBLIC.key) return `Z.ai (${process.env.ZAI_VISION_MODEL || 'glm-4.5v'})`;
  if (localSdkConfigured()) return 'Z.ai local (SDK do ambiente)';
  return null; // sem nenhum provedor de visão neste deploy — a UI avisa honestamente
}

function buildFlashcardsPrompt(discipline: string, topic: string, studentContext = ''): string {
  return [
    `Você cria flashcards de revisão espaçada em português brasileiro, na disciplina ${discipline}.`,
    studentContext ? `Contexto do aluno (do app dele): ${studentContext.slice(0, 400)}` : '',
    `Tema solicitado: "${topic}".`,
    'Regras OBRIGATÓRIAS:',
    '- Responda APENAS com um array JSON válido. Sem texto antes ou depois, sem markdown, sem blocos de código.',
    '- Cada elemento do array é um objeto com as chaves "front" e "back" (strings em português brasileiro).',
    '- Gere entre 4 e 6 cartões.',
    '- "front": pergunta curta e objetiva (uma linha). "back": resposta direta (1-3 frases ou um exemplo curto de código/fórmula).',
    '- Cubra conceitos-chave do tema, priorizando o que costuma cair em avaliação.',
    '- Se não souber o tema, gere cartões sobre os fundamentos mais importantes da disciplina.',
    'Exemplo de formato: [{"front":"O que é uma variável?","back":"Um nome que referencia um valor na memória, podendo ser reatribuído."}]',
  ].join('\n');
}

function buildFeynmanPrompt(discipline: string, topic: string): string {
  return [
    'Você é um avaliador especialista da Técnica Feynman: o aluno tentou explicar um tema com as próprias palavras, como se ensinasse uma criança de 10 anos.',
    `Disciplina: ${discipline}. Tema da explicação: ${topic || '(não especificado — infira pelo texto do aluno)'}.`,
    'Sua tarefa: avaliar a explicação do aluno com rigor, honestidade e encorajamento — o que está certo, o que falta e o que está errado.',
    'Se um trecho de material oficial do curso for fornecido abaixo, use-o como fonte da verdade para corrigir imprecisões.',
    '',
    'Responda em português brasileiro, em markdown, EXATAMENTE nesta estrutura:',
    '## Pontuação: X/100',
    '(uma linha justificando a nota)',
    '## O que você acertou',
    '- (itens concretos; se nada, escreva "Nada ainda — mas vamos construir juntos.")',
    '## Lacunas detectadas',
    '- (conceitos importantes do tema que faltaram na explicação)',
    '## Correções necessárias',
    '- (erros técnicos ou imprecisões, com a versão correta)',
    '## Sua ideia em uma frase',
    '(reescreva a ideia central do aluno de forma precisa e simples)',
    '## Próximo passo',
    '(1 ação específica e pequena para a próxima sessão)',
    '',
    'Regras: direto (máx. ~300 palavras); trate o aluno por "você"; não invente conteúdo fora do material e do conhecimento da disciplina; pontuação realista (20-45 = confusa, 50-70 = razoável com lacunas, 75-90 = boa, 90+ = excelente).',
  ].join('\n');
}

/** Blocos de dados do Hub para o prompt — nada de inventar: o que não veio, não existe. */
function buildHubBlock(hub?: HubContext): string {
  if (!hub) return '';
  const lines: string[] = [];

  if (hub.today) lines.push(`- Hoje: ${hub.today}`);
  if (hub.week) {
    const tw = hub.totalWeeks ? ` de ${hub.totalWeeks}` : '';
    lines.push(`- Semana atual do semestre: ${hub.week}${tw} (calendário oficial do app do aluno)`);
  }
  if (hub.professor) {
    const t = hub.professorTitle ? ` (${hub.professorTitle})` : '';
    const h = hub.hours ? ` — carga horária ${hub.hours}h` : '';
    lines.push(`- Professor da disciplina atual: ${hub.professor}${t}${h}`);
  }
  if (hub.nextEvaluations?.length) {
    const evs = hub.nextEvaluations
      .map((e) => {
        const when = e.date
          ? `${e.date} (faltam ${e.daysLeft} dia(s))`
          : `data ainda não divulgada pelo professor${e.week ? ` (semana ${e.week} do calendário — NÃO cite como prazo)` : ''}`;
        return `    • ${e.name} de ${e.discipline} — ${when}${e.description ? ` · conteúdo: ${e.description}` : ''}`;
      })
      .join('\n');
    lines.push(`- Próximas avaliações COM DATA OFICIAL:\n${evs}`);
  }
  if (hub.upcomingEvents?.length) {
    const evts = hub.upcomingEvents
      .map((e) => `    • ${e.name} — ${e.date} (faltam ${e.daysLeft} dia(s))`)
      .join('\n');
    lines.push(`- Agenda acadêmica (calendário oficial do campus):\n${evts}`);
  }
  if (hub.studentStats) {
    const s = hub.studentStats;
    lines.push(
      `- Progresso do aluno: ${s.materialsDone}/${s.materialsTotal} materiais concluídos · ${s.topicsDone}/${s.topicsTotal} tópicos dominados · ${s.pomodoroMinutes} min de foco (Pomodoro) · ${s.flashcardsDue} flashcard(s) para revisar hoje · ${s.exercisesSolved}/${s.exercisesTotal} exercícios resolvidos`,
    );
  }
  if (hub.examWeek) {
    const w = hub.examWeek;
    const parts: string[] = [`faltam ${w.provaDaysLeft} dia(s) para a prova`];
    if (w.planoHoje) {
      parts.push(
        `plano de hoje: "${w.planoHoje.titulo}" — ${w.planoHoje.feitas}/${w.planoHoje.total} tarefa(s) feita(s), ~${w.planoHoje.minutos} min`,
      );
    }
    if (w.diasAtras > 0) parts.push(`${w.diasAtras} dia(s) do plano ficaram para trás`);
    parts.push(
      w.simulado
        ? `simulado oficial: FEITO ✓ ${w.simulado.pct}% (meta ${w.simulado.meta})${
            w.simulado.porTopico.length
              ? ` — por tópico: ${w.simulado.porTopico
                  .map(
                    (t) =>
                      `${t.topico} ${t.solved}/${t.total}${
                        t.puladas > 0 ? ` (${t.puladas} pulada${t.puladas === 1 ? '' : 's'})` : ''
                      }`,
                  )
                  .join(' · ')}`
              : ''
          }${
            w.simulado.pulouTudo
              ? ` · bloco INTEIRO sem tentativa: ${w.simulado.pulouTudo} — a revisão começa por ele`
              : w.simulado.piorTopico
                ? ` · bloco fraco: ${w.simulado.piorTopico}`
                : ''
          }${
            w.simulado.treinoDoFoco && w.simulado.treinoDoFoco.pct !== null
              ? ` · treino do foco (${w.simulado.treinoDoFoco.quando}): ${w.simulado.treinoDoFoco.solved}/${w.simulado.treinoDoFoco.total} — ${w.simulado.treinoDoFoco.pct}%${
                  w.simulado.treinoDoFoco.melhorou === true
                    ? ' (a revisão cumpriu: a taxa subiu)'
                    : w.simulado.treinoDoFoco.melhorou === false
                      ? ' (não subiu — vale outra passada, ou outro ângulo)'
                      : ''
                }`
              : ''
          }`
        : `simulado oficial: ainda NÃO feito`,
    );
    parts.push(`questões travadas marcadas nas listas: ${w.travadasCount}`);
    lines.push(
      `- SEMANA DE PROVA (estado ao vivo, dados do app do aluno):\n    • ${parts.join(
        '\n    • ',
      )}\n    • Se o aluno perguntar o que revisar: com o simulado FEITO, priorize o bloco fraco ou o bloco inteiro pulado (bloco inteiro sem tentativa É o bloco com mais erros — comece a revisão por ele); SEM o simulado, mantenha o dia do plano — não antecipe pânico nem invente resultado. Se o treino do foco JÁ aconteceu e subiu, reconheça o progresso e mantenha o ritmo; se não subiu, proponha outro ângulo (refazer no papel, reler a fórmula daquele bloco antes de dormir) — nunca cobre duas vezes o que o registro já mostrou.`,
    );
  }

  if (lines.length === 0) return '';
  return [
    '',
    '=== CONTEXTO DO HUB (dados reais do app — use com precisão; não invente nada além deles) ===',
    ...lines,
    '=== FIM DO CONTEXTO DO HUB ===',
    '',
  ].join('\n');
}

function buildSystemPrompt(
  discipline: string,
  topic: string,
  material?: string,
  hub?: HubContext,
  materialBlock = '',
  hintMode = false,
  studentContext = '',
  courseBase = '',
): string {
  return [
    'Você é o tutor IA do app de estudos do aluno. Você conversa em português brasileiro.',
    courseBase
      ? [
          '=== CURSO — BASE INSTITUCIONAL DO APP (durável e oficial, mantida pelo código; datas são computadas na hora da chamada — o que já passou não aparece) ===',
          courseBase,
          '=== FIM DA BASE DO CURSO ===',
        ].join('\n')
      : '',
    studentContext
      ? [
          '=== ESTADO AO VIVO DO ALUNO (enviado pelo PRÓPRIO app dele NESTA chamada — o servidor usa e não armazena nada disto) ===',
          studentContext,
          '=== FIM DO ESTADO DO ALUNO ===',
        ].join('\n')
      : '',
    `Disciplina atual: ${discipline}.`,
    topic ? `Tópico em estudo agora: "${topic}".` : '',
    material ? `Material aberto: "${material}".` : '',
    materialBlock,
    buildHubBlock(hub),
    hintMode
      ? [
          'MODO DICA ATIVADO (pedagógico — o aluno quer APRENDER, não copiar):',
          '- Para EXERCÍCIO ou problema enviado: NÃO entregue a solução completa de primeira. Responda em 3 estágios curtos:',
          '  1) Uma pergunta-guia que ative o que o aluno já sabe sobre o problema;',
          '  2) A dica principal — o caminho/conceito-chave, SEM o resultado final;',
          '  3) Feche oferecendo: "Quando tentar, me conta onde travou — ou pede que eu resolvo passo a passo."',
          '- PROIBIDO no 1º turno do modo dica: código completo, o resultado final, a resolução numérica ou a matriz/fórmula pronta. Mesmo que pareça útil — a solução completa SÓ sai quando o aluno tentar e travar ou pedir explicitamente de novo (veja no HISTÓRICO).',
          '- Se o aluno insistir (pediu de novo, já tentou e travou), aí sim resolva COMPLETO, passo a passo.',
          '- Dúvida CONCEITUAL (definição, teoria, datas, explicação): responda normalmente — o modo dica vale para exercícios e problemas, não para explicar teoria.',
        ].join('\n')
      : '',
    'COMO ESTRUTURAR AS RESPOSTAS (markdown) — CONVERSA DE TUTOR, NÃO ARTIGO:',
    '- Abra com a resposta direta à pergunta (1-2 frases). Depois explique o mínimo necessário com UM exemplo.',
    '- CURTO ACIMA DE TUDO: ~150 palavras por resposta; só passe de ~300 se o aluno pedir resolução completa passo a passo ou programa inteiro. Parágrafos de 1-3 linhas.',
    '- ESTRUTURA SIMPLES: **negrito** só em conceitos-chave; listas numeradas para passos. PROIBIDO no corpo da conversa: cabeçalhos (##/###), linhas horizontais (---), seções decorativas ("Visão geral", "Conclusão"), tabela quando uma lista resolve. Tabela só para tabela-verdade ou comparação linha a linha.',
    '- TOM: professor calmo, direto e acolhedor. ZERO EMOJIS (nenhum). ZERO hype: jamais "o segredo é", "garantir pontos", contagem regressiva de pontos, promessa de nota, "boa prova 🚀" ou bajulação inicial ("ótima pergunta!").',
    '- FECHAMENTO: no máximo UMA pergunta curta ("Quer tentar outra?") OU um próximo passo em 1 linha. PROIBIDO o final de duas opções ("Quer X ou prefere Y?") e frase de marketing.',
    '- Código e pseudocódigo SEMPRE em bloco de código (```); fórmulas matemáticas NÃO — elas vão direto no markdown em LaTeX.',
    '- MATEMÁTICA EM LATEX (o app renderiza KaTeX — use SEMPRE que aparecer matemática): inline com $...$ (ex.: $A^{-1}$, $a_{12} = 5$); blocos com $$...$$; matrizes com \begin{pmatrix} … \end{pmatrix}; frações com \frac{a}{b}; raízes com \sqrt{x}; multiplicação com \cdot. Ex.: $$A \cdot A^{-1} = I_2$$. PROIBIDO: delimitadores \( \) e \[ \]; matriz desenhada em texto corrido ([ 1 2 / 3 4 ]); fórmula complexa em texto simples quando pode ser LaTeX ($\frac{1}{|A|}$ em vez de 1/|A|).',
    '- MATRIZ À PROVA DE FALHA: o par \begin{pmatrix} … \end{pmatrix} é INSEPARÁVEL e morre dentro de UM único $$…$$ — escreva a matriz inteira de uma vez (linhas separadas por \\, elementos por &), NUNCA feche o $$ antes do \end{pmatrix}, NUNCA deixe & ou \\ soltos fora de um ambiente. Matriz quebrada = o aluno vê um erro vermelho em vez da aula.',
    '- EXEMPLOS DE CÓDIGO: em C, sempre (é a linguagem do curso desde o início). Pseudocódigo Portugol (ALGORITMO / VAR / INICIO / LEIA / ESCREVA / SE … ENTAO / ENQUANTO … FACA) só para explicar a LÓGICA abstrata ANTES do código, ou se o aluno pedir explicitamente.',
    '- CÓDIGO C ORGANIZADO (toda vez): bloco com a marcação ```c; indentação de 4 espaços (NUNCA tabulação); uma instrução por linha; chave abre na mesma linha da estrutura (if/for/while); nomes descritivos em português (mediaFinal, contadorAlunos, somaNotas) — nada de a, x, t sem sentido; comentário curto em PT-BR só onde ajuda; alinhamento vertical em atribuições repetidas quando melhorar a leitura. Programa pedido pelo aluno = código COMPLETO e compilável (#include no topo, int main, return 0).',
    '- ATIVIDADES/EXERCÍCIOS PROPOSTOS (formato fixo e legível): "Exercício." + enunciado curto em 1-2 frases; se houver entrada/saída, mostre "Entrada:" e "Saída esperada:" cada uma em bloco de código separado (sem marcação de linguagem); depois "Dica:" em UMA linha; por fim "Como conferir:" com o teste que valida a resposta. Vários exercícios? Numere (1., 2., 3.) e limite a 3.',
    '- Próximo passo prático (mini-exercício ou conexão com o material/prova) SÓ se couber em 1 linha — vale o FECHAMENTO da regra acima.',
    '- DATAS OFICIAIS OBRIGATÓRIAS: ao falar de prova, entrega ou atividade que tenha data na BASE DE CONHECIMENTO ou no CONTEXTO DO HUB, cite a data (dd/mm) na resposta — nunca descreva formato/conteúdo de uma avaliação sem a data quando ela existe.',
    '- NÚMEROS SÃO OBRIGATÓRIOS: se a pergunta pede dados/resultados e o material fornecido ou a base tem números (amostra, %, valores de tabela), cite-os LITERALMENTE na resposta — resposta só qualitativa quando os números existem = reprovada.',
    '',
    'STACK DE PRÁTICA DO CURSO (trate como fato quando perguntarem de linguagens):',
    '- O curso é 100% em C DESDE O INÍCIO: os primeiros programas já são escritos em C, compilados com gcc (terminal Linux, VS Code ou Replit — a rotina do Hub tem até "Revisão de C").',
    '- Portugol apareceu APENAS como pseudocódigo introdutório para lógica — NUNCA diga que "a disciplina é em Portugol" ou que C "vem depois". Quem disser isso está desatualizado.',
    '- Linguagens de Marcação usa HTML (estrutura) e CSS (estilo) no projeto prático.',
    '- Detalhe curricular além disso (qual unidade usa qual recurso): SÓ afirme se estiver no CONTEXTO DO HUB. Caso contrário, diga o que sabe do stack e que o professor (cite-o se estiver no contexto) confirmará os detalhes.',
    '',
    ...contentKnowledgeLines(),
    '',
    '- CONTEXTO MANDA: prioridades, prazos e ordem de estudo vêm do CONTEXTO DO HUB desta conversa (materiais atuais, avaliações com data, tópicos fracos do aluno). Jamais cite planos, cards ou prioridades fixos que não estejam nesse contexto — a casa não mantém planos congelados.',
    '- Ao recomendar ordem de estudo: resolver LISTAS primeiro (prática real), teoria só como consulta. Uma prática por resposta.',
    '',
    ...materialFirstPolicyLines(),
    '',
    'O QUE VOCÊ PODE E COMO AGIR:',
    '- Perguntas sobre o próprio Hub ou a turma (professor, datas de prova, calendário, progresso do aluno, como usar o app): responda com precisão usando o CONTEXTO DO HUB. NUNCA diga que "não tem acesso" ao que está listado ali.',
    '- Perguntas sobre DATAS: só confirme o que estiver na BASE DO CURSO (próximas avaliações e agenda oficial — computadas no momento da chamada; data que passou não aparece) ou em "Próximas avaliações COM DATA OFICIAL" do CONTEXTO DO HUB. Para as demais avaliações (A2/A3 de LM, seminário, N1/N2, Av de Fundamentos), diga que a data ainda não foi divulgada e sugira confirmar com o professor/SUAP — NUNCA estime semana ou prazo (estimativa engana o aluno).',
    '- SOBRE PESSOAS REAIS (professor, colegas): cite APENAS o que está no CONTEXTO DO HUB (nome, título, carga horária). NUNCA invente biografia, pesquisas, experiências ou opiniões que não estejam ali.',
    '- Dúvidas do conteúdo da disciplina: sua prioridade. Conecte com o tópico/material atual quando fizer sentido.',
    '- CONTINUIDADE DA CONVERSA (crítico): o HISTÓRICO DA CONVERSA traz as mensagens anteriores. Se a mensagem atual for continuação ("e isso?", "por quê?", "não entendi", "e a questão 2?", "outro exemplo", "continua"), conecte com o que você já respondeu e CONTINUE o raciocínio — NÃO trate como pergunta solta, NÃO mude de assunto, NÃO re-explique do zero. Refira-se naturalmente ao que foi dito antes ("como mostrei acima…"). Só trate como tópico novo se ela realmente introduzir um assunto diferente.',
    '- IMAGENS ANEXADAS: quando a pergunta trouxer o bloco "IMAGEM ANEXADA" (transcrição do print/foto), trate-o como a questão LITERAL do aluno — resolva com base nele, citando os números exatos da transcrição. Se a transcrição estiver incompleta ou ambígua, diga o que faltou e pergunte ao aluno.',
    '- TEXTO COLADO QUEBRADO (PDF): quando o aluno colar texto de PDF que veio rasgado (variáveis perdidas, fórmulas desmontadas, letras sumidas — comum em extração de texto de matemática), NÃO resolva o texto quebrado como se fosse a questão: procure a versão ÍNTEGRA no bloco de MATERIAL (trechos abaixo) e reconstrua a partir dela, dizendo "reconstruí pelo material". Se os dados que faltam não estão em lugar nenhum, aponte exatamente o que ficou ilegível e ofereça o caminho certo: "captura a questão (botão de câmera do tutor) que eu leio direto da imagem" — nunca chute valores que sumiram.',
    '- Assuntos gerais/paralelos (ferramentas, carreira, curiosidades, esporte, música, cultura pop): você é um TUTOR AMIGO, não um assistente corporativo restrito. Responda de forma BREVE, leve e divertida — se pedirem palpite, dê um com humor e humildade ("sou só uma IA, mas..."). Depois conecte com os estudos (ex.: "agora bora canalizar essa energia num exercício"). PROIBIDO: dizer "meu papel é exclusivamente", "não posso falar sobre isso", "conforme o contexto fornecido" ou dar sermão sobre foco. NUNCA recuse de forma seca.',
    '- Não invente dados institucionais ausentes do contexto (sala, e-mail, notas, plantão). Se pedirem algo que não está lá, diga o que sabe e aponte o canal certo (SUAP, Classroom ou o professor).',
    '- Se não souber um conteúdo específico, admita com honestidade e sugira revisar o material aberto ou o PDF da disciplina.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Chama um modelo da OpenRouter com timeout; retorna o conteúdo ou lança erro.
 *  Com onDelta: usa stream:true e repassa cada pedaço conforme chega (SSE). */
async function callOpenRouter(
  model: string,
  apiKey: string,
  systemPrompt: string,
  history: ChatMessage[],
  question: string,
  onDelta?: (piece: string) => void,
): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // streaming: TTFT 22s e rearmamento 20s a cada delta (nunca congela)
  const arm = (ms?: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), ms ?? MODEL_TIMEOUT_MS);
  };
  arm(onDelta ? 22_000 : MODEL_TIMEOUT_MS);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hub-estudos-ifpb.app',
        'X-Title': 'Hub de Estudos IFPB',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: question },
        ],
        ...(onDelta ? { stream: true } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${detail.slice(0, 200)}`);
    }

    if (onDelta && res.body) {
      const full = await consumeSSE(res, onDelta, (ms) => arm(ms), (json) =>
        json.choices?.[0]?.delta?.content,
      );
      if (!full.trim()) throw new Error('stream vazio');
      return full.trim();
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    if (data.error) throw new Error(data.error.message ?? 'erro da OpenRouter');

    const content = data.choices?.[0]?.message?.content;
    if (!content || !content.trim()) throw new Error('resposta vazia');
    return content.trim();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Separa um data URL em mime type + base64 puro (para inline_data do Gemini). */
function parseDataUrl(dataUrl: string): { mime: string; b64: string } | null {
  // [\s\S] em vez do flag "s" (tsconfig target < es2018 não aceita o flag)
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
  return m ? { mime: m[1], b64: m[2] } : null;
}

/**
 * Google Gemini via REST puro (sem SDK — roda em qualquer serverless, incl. Vercel).
 * Suporta histórico, streaming SSE (alt=sse) e imagem anexada (inline_data).
 * Tier grátis do AI Studio: gemini-2.5-flash-lite ~1000 req/dia — sem cartão.
 */
async function callGemini(
  model: string,
  apiKey: string,
  systemPrompt: string,
  history: ChatMessage[],
  question: string,
  onDelta?: (piece: string) => void,
  imageDataUrl?: string,
): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = (ms?: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), ms ?? MODEL_TIMEOUT_MS);
  };
  arm(onDelta ? 22_000 : MODEL_TIMEOUT_MS);

  try {
    const parts: Record<string, unknown>[] = [{ text: question }];
    if (imageDataUrl) {
      const img = parseDataUrl(imageDataUrl);
      if (img) parts.push({ inline_data: { mime_type: img.mime, data: img.b64 } });
    }
    const contents = [
      ...history.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts },
    ];

    const method = onDelta ? 'streamGenerateContent?alt=sse' : 'generateContent';
    const res = await fetch(`${GEMINI.baseUrl}/models/${model}:${method}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.6, maxOutputTokens: 4096 },
        // aulas/matemática não podem travar em filtro conservador — só bloqueia alto risco
        safetySettings: [
          'HARM_CATEGORY_HARASSMENT',
          'HARM_CATEGORY_HATE_SPEECH',
          'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          'HARM_CATEGORY_DANGEROUS_CONTENT',
        ].map((category) => ({ category, threshold: 'BLOCK_ONLY_HIGH' })),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${detail.slice(0, 200)}`);
    }

    if (onDelta && res.body) {
      const full = await consumeSSE(res, onDelta, (ms) => arm(ms), (json) => {
        const piece = json.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? '')
          .join('');
        return piece || undefined;
      });
      if (!full.trim()) throw new Error('stream vazio');
      return full.trim();
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
      error?: { message?: string };
    };
    if (data.error) throw new Error(data.error.message ?? 'erro da API Gemini');
    if (data.promptFeedback?.blockReason) {
      throw new Error(`bloqueado: ${data.promptFeedback.blockReason}`);
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) throw new Error('resposta vazia');
    return text;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Consome uma resposta SSE, repassando deltas extraídos por `extract`.
 *  rearma o timeout de inatividade a cada chunk recebido. */
async function consumeSSE(
  res: Response,
  onDelta: (piece: string) => void,
  rearm: (ms?: number) => void,
  extract: (json: Record<string, any>) => string | undefined,
): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let full = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    rearm(20_000); // inatividade no meio do stream → corta
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue; // comentários/keepalive
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return full;
      try {
        const json = JSON.parse(payload) as Record<string, any>;
        if (json.error?.message) throw new Error(json.error.message);
        const piece = extract(json);
        if (piece) {
          full += piece;
          onDelta(piece);
        }
      } catch (e) {
        // JSON parcial entre chunks — ignora; erro de provider real propaga
        if (e instanceof Error && e.message && !/JSON/i.test(e.message)) throw e;
      }
    }
  }
  return full;
}

/** Chama a API pública da Z.ai (OpenAI-compatible, api.z.ai/api/paas/v4). */
async function callZAIPublic(
  apiKey: string,
  systemPrompt: string,
  history: ChatMessage[],
  question: string,
  onDelta?: (piece: string) => void,
): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = (ms?: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), ms ?? MODEL_TIMEOUT_MS);
  };
  arm(onDelta ? 22_000 : MODEL_TIMEOUT_MS);

  try {
    const res = await fetch(`${ZAI_PUBLIC.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ZAI_PUBLIC.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: question },
        ],
        ...(onDelta ? { stream: true } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${detail.slice(0, 200)}`);
    }

    if (onDelta && res.body) {
      const full = await consumeSSE(res, onDelta, (ms) => arm(ms), (json) =>
        json.choices?.[0]?.delta?.content,
      );
      if (!full.trim()) throw new Error('stream vazio');
      return full.trim();
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    if (data.error) throw new Error(data.error.message ?? 'erro da API Z.ai');

    const content = data.choices?.[0]?.message?.content;
    if (!content || !content.trim()) throw new Error('resposta vazia');
    return content.trim();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// 4º elo — SDK local (z-ai-web-dev-sdk): credenciais DO PRÓPRIO AMBIENTE
// (arquivo .z-ai-config do sandbox/servidor do dono). Não exige NENHUMA key no
// deploy: é o elo que mantém o tutor VIVO neste ambiente sem chave. Num deploy
// externo sem o arquivo de config, localSdkConfigured() = false e a cadeia
// termina no erro honesto de chave — comportamento de produção inalterado.
// ---------------------------------------------------------------------------

const LOCAL_SDK_VISION_MODEL = process.env.ZAI_SDK_VISION_MODEL || 'glm-4.5v';

/** O SDK tem credenciais neste ambiente? (mesma busca que o loadConfig dele faz) */
function localSdkConfigured(): boolean {
  const paths = [
    `${process.cwd()}/.z-ai-config`,
    `${process.env.HOME ?? ''}/.z-ai-config`,
    '/etc/.z-ai-config',
  ];
  for (const p of paths) {
    try {
      const cfg = JSON.parse(readFileSync(p, 'utf-8')) as { baseUrl?: string; apiKey?: string };
      if (cfg.baseUrl && cfg.apiKey) return true;
    } catch {
      // arquivo ausente/ilegível — tenta o próximo caminho
    }
  }
  return false;
}

let localSdkPromise: Promise<ZAI> | null = null;
function getLocalSdk(): Promise<ZAI> {
  if (!localSdkPromise) localSdkPromise = ZAI.create();
  return localSdkPromise;
}

/** Corrida contra o relógio: o fetch interno do SDK não aceita AbortSignal nosso. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label}: sem resposta em ${Math.round(ms / 1000)}s`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Tutoria pelo SDK local — texto, todos os modos (tutor/flashcards/feynman).
 * Sem onDelta responde em JSON; com onDelta usa o stream SSE do gateway
 * (formato OpenAI-compatible — o mesmo parser consumeSSE da casa serve).
 */
async function callLocalSDK(
  systemPrompt: string,
  history: ChatMessage[],
  question: string,
  onDelta?: (piece: string) => void,
): Promise<{ text: string; model: string }> {
  const sdk = await getLocalSdk();
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history,
    { role: 'user' as const, content: question },
  ];

  if (!onDelta) {
    const completion = (await withTimeout(
      sdk.chat.completions.create({ messages, thinking: { type: 'disabled' } }),
      MODEL_TIMEOUT_MS,
      'sdk-local',
    )) as { choices?: { message?: { content?: string } }[]; model?: string };
    const content = completion?.choices?.[0]?.message?.content;
    if (!content || !content.trim()) throw new Error('resposta vazia (sdk-local)');
    return { text: content.trim(), model: `Z.ai local (${completion.model || 'glm-4'})` };
  }

  // streaming: o SDK devolve o ReadableStream SSE cru
  const body = await withTimeout(
    sdk.chat.completions.create({ messages, stream: true, thinking: { type: 'disabled' } }),
    22_000,
    'sdk-local (stream)',
  );
  if (body instanceof ReadableStream) {
    let model = '';
    const full = await withTimeout(
      consumeSSE(new Response(body), onDelta, () => {}, (json) => {
        if (json.model && !model) model = String(json.model);
        return json.choices?.[0]?.delta?.content;
      }),
      50_000,
      'sdk-local (leitura do stream)',
    );
    if (!full.trim()) throw new Error('stream vazio (sdk-local)');
    return { text: full.trim(), model: `Z.ai local (${model || 'glm-4'})` };
  }
  // gateway devolveu JSON mesmo com stream:true — resposta completa de uma vez
  const content = (body as { choices?: { message?: { content?: string } }[] })?.choices?.[0]
    ?.message?.content;
  const text = content?.trim();
  if (!text) throw new Error('stream vazio (sdk-local)');
  onDelta(text);
  return { text, model: 'Z.ai local (glm-4)' };
}

/** Transcrição de imagem pelo SDK local (createVision). */
async function callLocalSDKVision(instruction: string, dataUrl: string): Promise<string> {
  const sdk = await getLocalSdk();
  const res = (await withTimeout(
    sdk.chat.completions.createVision({
      model: LOCAL_SDK_VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: instruction },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    }),
    MODEL_TIMEOUT_MS,
    'sdk-local (visão)',
  )) as { choices?: { message?: { content?: string } }[] };
  const content = res?.choices?.[0]?.message?.content;
  if (!content || !content.trim()) throw new Error('resposta vazia (sdk-local visão)');
  return content.trim();
}

/**
 * Transcreve a imagem anexada (print/foto da questão) com o PRIMEIRO modelo de
 * visão disponível — cadeia pensada para funcionar 100% na Vercel com keys grátis:
 *
 *  1º Gemini (GEMINI_API_KEY)      — visão nativa, tier grátis generoso (RECOMENDADO)
 *  2º OpenRouter (OPENROUTER_API_KEY) — modelos free que aceitam imagem
 *  3º Z.ai público (ZAI_API_KEY)   — glm-4.5v via api.z.ai
 *  4º SDK local (credenciais do ambiente) — glm-4.5v via z-ai-web-dev-sdk
 *
 * A transcrição vira a "pergunta efetiva" — assim qualquer provedor de TEXTO da
 * cadeia responde com a questão na mão, e ela também entra no retrieval.
 */
async function transcribeImage(dataUrl: string, userNote: string): Promise<string> {
  const instruction = buildTranscriptionInstruction(userNote);
  const errors: string[] = [];

  // 1º — Gemini: 1 key grátis resolve visão + texto na Vercel (salva na casa → env)
  const geminiCfg = await getEffectiveGeminiConfig();
  const gKey = geminiCfg.key;
  if (gKey) {
    for (const model of geminiCfg.model) {
      try {
        const out = await callGemini(
          model,
          gKey,
          TRANSCRIBER_SYSTEM,
          [],
          userNote || 'Transcreva a imagem anexada com fidelidade total.',
          undefined,
          dataUrl,
        );
        if (out) return out;
      } catch (err) {
        errors.push(`gemini/${model}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  // 2º — OpenRouter: modelos free de visão (formato OpenAI image_url)
  const oKey = process.env.OPENROUTER_API_KEY;
  if (oKey) {
    for (const model of VISION_CHAIN_OPENROUTER) {
      try {
        const out = await callOpenRouterVision(model, oKey, instruction, dataUrl);
        if (out) return out;
      } catch (err) {
        errors.push(`openrouter/${model}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  // 3º — Z.ai público (glm-4.5v) — se o dono configurou ZAI_API_KEY
  const zKey = ZAI_PUBLIC.key;
  if (zKey) {
    try {
      const out = await callZAIVision(zKey, instruction, dataUrl);
      if (out) return out;
    } catch (err) {
      errors.push(`zai-public: ${err instanceof Error ? err.message : err}`);
    }
  }

  // 4º — SDK local (credenciais do ambiente — glm-4.5v via createVision)
  if (localSdkConfigured()) {
    try {
      const out = await callLocalSDKVision(instruction, dataUrl);
      if (out) return out;
    } catch (err) {
      errors.push(`sdk-local: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (errors.length) {
    console.warn('[api/tutor] cadeia de visão esgotou:', errors.join(' | '));
  }
  return '';
}

/** Instrução de transcrição fiel (compartilhada por toda a cadeia de visão). */
const TRANSCRIBER_SYSTEM = [
  'Você é o transcritor oficial do Hub de Estudos. Transcreva a imagem anexa para texto em português brasileiro, com fidelidade TOTAL:',
  '- Enunciados, questões, alternativas, números, matrizes e unidades EXATAMENTE como aparecem (não invente, não corrija, não resolva).',
  '- Matemática em LaTeX: $...$ inline; $$...$$ para blocos; matrizes com \\begin{pmatrix}…\\end{pmatrix}.',
  '- Código C na imagem → bloco de código ```c.',
  '- Comece direto com a transcrição (sem preâmbulo). Se a imagem não tiver relação com estudo, descreva o que ela mostra em 1-2 frases.',
].join('\n');

function buildTranscriptionInstruction(userNote: string): string {
  return (
    TRANSCRIBER_SYSTEM +
    (userNote ? `\nContexto: o aluno escreveu junto: "${userNote.slice(0, 300)}".` : '')
  );
}

/** Transcrição via OpenRouter (formato OpenAI multimodal: image_url com data URL). */
async function callOpenRouterVision(
  model: string,
  apiKey: string,
  instruction: string,
  dataUrl: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hub-estudos-ifpb.app',
        'X-Title': 'Hub de Estudos IFPB',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: instruction },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null } }[];
      error?: { message?: string };
    };
    if (data.error) throw new Error(data.error.message);
    const content = data.choices?.[0]?.message?.content;
    if (!content || !content.trim()) throw new Error('resposta vazia');
    return content.trim();
  } finally {
    clearTimeout(timer);
  }
}

/** Transcrição via API pública da Z.ai (glm-4.5v, OpenAI-compatible). */
async function callZAIVision(
  apiKey: string,
  instruction: string,
  dataUrl: string,
): Promise<string> {
  const model = process.env.ZAI_VISION_MODEL || 'glm-4.5v';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const res = await fetch(`${ZAI_PUBLIC.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: instruction },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null } }[];
      error?: { message?: string };
    };
    if (data.error) throw new Error(data.error.message);
    const content = data.choices?.[0]?.message?.content;
    if (!content || !content.trim()) throw new Error('resposta vazia');
    return content.trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Diagnóstico (GET ?probe=1): ping REAL de cada provedor com ~10 tokens —
 * mostra nas Configurações se cada key funciona DE VERDADE (não só se existe),
 * com latência e a mensagem de erro exata quando falha (key inválida, quota,
 * região bloqueada…). Custo desprezível no tier grátis.
 */
type ProbeResult = { ok: boolean; ms: number; model?: string; error?: string; source?: string };

async function probeRun(
  ms: number,
  run: (signal: AbortSignal) => Promise<void>,
): Promise<{ ms: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const t0 = Date.now();
  try {
    await run(controller.signal);
    return { ms: Date.now() - t0 };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const error = /abort/i.test(raw) ? `sem resposta em ${ms / 1000}s` : raw.slice(0, 200);
    return { ms: Date.now() - t0, error };
  } finally {
    clearTimeout(timer);
  }
}

/** Rótulo humano da fonte da chave do Gemini (o probe confessa de onde ela veio). */
function geminiSourceLabel(source: 'db' | 'env' | null): string {
  if (source === 'db') return 'salva na casa';
  if (source === 'env') return 'variável de ambiente';
  return 'nenhuma';
}

async function probeProviders(geminiModelOverride?: string | null): Promise<Response> {
  const jobs: Record<string, Promise<ProbeResult>> = {};

  // — Gemini: generateContent com 10 tokens (mesmo modelo que atende as dúvidas)
  //   A CHAVE PERFEITA: o probe testa a chave EFETIVA (salva no banco → env) e
  //   confessa a fonte — "salva na casa" vs "variável de ambiente" vs "nenhuma".
  const geminiCfg = await getEffectiveGeminiConfig();
  if (geminiCfg.key) {
    const key = geminiCfg.key;
    // ?probe=1&geminiModel=X testa um modelo específico — descobre o que a key aceita
    const model = geminiModelOverride || geminiCfg.model[0];
    jobs.gemini = (async () => {
      const r = await probeRun(15_000, async (signal) => {
        const res = await fetch(`${GEMINI.baseUrl}/models/${model}:generateContent`, {
          method: 'POST',
          signal,
          headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Responda apenas: ok' }] }],
            // 1024: modelos thinking (ex. flash-latest) gastam tokens no raciocínio —
            // com limite pequeno a resposta visível fica vazia e o probe acusaria falha falsa
            generationConfig: { maxOutputTokens: 1024, temperature: 0 },
          }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} — ${detail.slice(0, 400)}`);
        }
        const data = await res.json();
        const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
          .map((p: { text?: string }) => p.text ?? '')
          .join('')
          .trim();
        if (!text) throw new Error('resposta vazia (quota esgotada ou bloqueio?)');
      });
      return { ok: !r.error, ms: r.ms, model: prettyModelName(model) || model, error: r.error, source: geminiSourceLabel(geminiCfg.source) };
    })();
  } else {
    jobs.gemini = Promise.resolve({
      ok: false,
      ms: 0,
      error: 'nenhuma chave — a casa usa o elo seguinte (OpenRouter → Z.ai → SDK local)',
      source: geminiSourceLabel(null),
    });
  }

  // — OpenRouter: 1ª posição da cadeia do tutor
  if (process.env.OPENROUTER_API_KEY) {
    const key = process.env.OPENROUTER_API_KEY;
    const model = MODEL_CHAIN.tutor[0];
    jobs.openrouter = (async () => {
      const r = await probeRun(15_000, async (signal) => {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          signal,
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://hub-estudos-ifpb.app',
            'X-Title': 'Hub de Estudos IFPB',
          },
          body: JSON.stringify({
            model,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Responda apenas: ok' }],
          }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} — ${detail.slice(0, 160)}`);
        }
        const data = await res.json();
        if (!data?.choices?.[0]?.message?.content) throw new Error('resposta vazia');
      });
      return { ok: !r.error, ms: r.ms, model: prettyModelName(model), error: r.error };
    })();
  } else {
    jobs.openrouter = Promise.resolve({ ok: false, ms: 0, error: 'sem OPENROUTER_API_KEY' });
  }

  // — Z.ai público (opcional)
  if (process.env.ZAI_API_KEY) {
    const key = process.env.ZAI_API_KEY;
    jobs.zai = (async () => {
      const r = await probeRun(15_000, async (signal) => {
        const res = await fetch(`${ZAI_PUBLIC.baseUrl}/chat/completions`, {
          method: 'POST',
          signal,
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ZAI_PUBLIC.model,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Responda apenas: ok' }],
          }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} — ${detail.slice(0, 160)}`);
        }
        const data = await res.json();
        if (!data?.choices?.[0]?.message?.content) throw new Error('resposta vazia');
      });
      return { ok: !r.error, ms: r.ms, model: ZAI_PUBLIC.model, error: r.error };
    })();
  } else {
    jobs.zai = Promise.resolve({ ok: false, ms: 0, error: 'sem ZAI_API_KEY (opcional)' });
  }

  const [gemini, openrouter, zai] = await Promise.all([jobs.gemini, jobs.openrouter, jobs.zai]);
  const first = gemini.ok ? 'Gemini' : openrouter.ok ? 'OpenRouter' : zai.ok ? 'Z.ai' : 'nenhuma key configurada';
  return Response.json({
    probe: {
      at: new Date().toISOString(),
      firstToAnswer: first,
      geminiKeySource: geminiSourceLabel(geminiCfg.source),
      gemini,
      openrouter,
      zai,
    },
  });
}

/** GET: lista os modelos em uso + status de provedores (para exibir nas Configurações). */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  // diagnóstico das chaves — Configurações → "Testar agora" (aceita &geminiModel=X p/ testar modelo específico)
  if (params.get('probe')) return probeProviders(params.get('geminiModel'));
  const vision = await visionProviderLabel();
  const geminiCfg = await getEffectiveGeminiConfig();
  return Response.json({
    provider: 'gemini → openrouter → z.ai público → sdk local (primeiro disponível)',
    vision: vision ?? 'não configurada — salve a key grátis do Gemini (aistudio.google.com) em Configurações → Inteligência da casa para ler prints',
    chains: {
      tutor: MODEL_CHAIN.tutor.map((id) => ({ id, label: prettyModelName(id) })),
      flashcards: MODEL_CHAIN.flashcards.map((id) => ({ id, label: prettyModelName(id) })),
      vision: [
        ...(geminiCfg.key ? geminiCfg.model.map((id) => ({ id, label: prettyModelName(id) })) : []),
        ...VISION_CHAIN_OPENROUTER.map((id) => ({ id, label: prettyModelName(id) })),
      ],
    },
    providers: {
      gemini: Boolean(geminiCfg.key),
      // fonte da chave do Gemini: 'db' (salva na casa) | 'env' | null — a UI é honesta sobre quem atende
      geminiSource: geminiCfg.source,
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      zaiPublic: Boolean(process.env.ZAI_API_KEY),
      localSdk: localSdkConfigured(),
    },
  });
}

/**
 * normalizeMath: normaliza \[...\]/\(...\) para $$...$$/$...$ — o tutor-markdown
 * AGORA renderiza LaTeX com KaTeX, então a matemática segue matemática.
 */

/** Limites da memória por disciplina — economia de armazenamento. */
// O teto vem da FONTE ÚNICA (t151, lib/tutor-history-view): 80 mensagens —
// a poda a 40 virava a CEIRA da memória (a noite do debrief do simulado, 3
// conversas valiosas, empurrava a semana do aluno para fora do banco em
// silêncio). O prompt da IA não lê daqui (o cliente manda as últimas 12):
// o custo é de armazenamento, não de contexto.
const HISTORY_KEEP = TUTOR_HISTORY_KEEP;
const MSG_CAP = 4000;

/** Salva a dupla pergunta+resposta e poda o histórico (mantém as 80 mais novas). */
async function saveTurn(discipline: string, question: string, answer: string, model: string): Promise<void> {
  const key = discipline.slice(0, 40);
  if (!key || key === 'geral') return;
  await db.tutorMessage.createMany({
    data: [
      { discipline: key, role: 'user', content: question.slice(0, MSG_CAP) },
      { discipline: key, role: 'assistant', content: answer.slice(0, MSG_CAP), model: model || null },
    ],
  });
  const old = await db.tutorMessage.findMany({
    where: { discipline: key },
    orderBy: { createdAt: 'desc' },
    skip: HISTORY_KEEP,
    select: { id: true },
  });
  if (old.length) {
    await db.tutorMessage.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  }
}

const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TutorRequestBody;
    const question = (body.question ?? '').trim();
    const discipline = (body.discipline ?? 'Estudos').trim();
    const disciplineKey = (body.disciplineCode || discipline).slice(0, 40);
    const topic = (body.topic ?? '').trim();
    const material = body.material?.trim();
    const isFlashcardsMode = body.mode === 'flashcards';
    const isFeynmanMode = body.mode === 'feynman';
    const useStream = !isFlashcardsMode && !isFeynmanMode && body.stream === true;

    // A CHAVE PERFEITA — lida UMA vez por requisição (cache em memória no lib):
    // chave SALVA pelo dono (DB) → env → sem chave (a cadeia segue ao próximo elo).
    const geminiCfg = await getEffectiveGeminiConfig();

    const imageDataUrl =
      typeof body.imageDataUrl === 'string' &&
      body.imageDataUrl.startsWith('data:image/') &&
      body.imageDataUrl.length <= 8_000_000
        ? body.imageDataUrl
        : undefined;

    if (!question && !imageDataUrl) {
      return Response.json({ error: 'Pergunta vazia.' }, { status: 400 });
    }
    // 6000: os construtores de debriefing (simulado/caderno de erros) mandam
    // listas longas de itens — o limite antigo de 2000 rejeitava prompts
    // legítimos com 400 e o aluno via a mensagem morrer sem resposta.
    if (question.length > 6000) {
      return Response.json(
        { error: 'Pergunta muito longa (máx. 6000 caracteres).' },
        { status: 400 },
      );
    }

    // ----- Imagem anexada (print/foto da questão) → transcrição com visão ------
    // A transcrição vira a pergunta efetiva: o provedor de TEXTO resolve a partir
    // dela e o retrieval encontra o material certo pela transcrição.
    let effectiveQuestion = question;
    let savedQuestion = question;
    if (imageDataUrl && !isFlashcardsMode && !isFeynmanMode) {
      const t0v = Date.now();
      try {
        const transcript = (await transcribeImage(imageDataUrl, question)).slice(0, 4000);
        if (transcript) {
          effectiveQuestion = [
            question || 'Resolva e explique passo a passo a questão da imagem anexada.',
            '',
            '=== IMAGEM ANEXADA (transcrição fiel do print — trate como a questão literal do aluno) ===',
            transcript,
            '=== FIM DA IMAGEM ===',
          ].join('\n');
          savedQuestion = `[print anexado] ${question || transcript.slice(0, 280)}`;
          console.log(
            `[api/tutor] imagem transcrita em ${Date.now() - t0v}ms (${transcript.length} chars)`,
          );
        } else if (!question) {
          const visionReady = Boolean(
            geminiCfg.key || process.env.OPENROUTER_API_KEY || ZAI_PUBLIC.key || localSdkConfigured(),
          );
          return Response.json(
            {
              error: visionReady
                ? 'Não consegui ler a imagem agora. Tente de novo ou digite sua dúvida em texto.'
                : 'Leitura de imagem ainda não configurada neste deploy. Dono: cole a key grátis do ' +
                  'Gemini (aistudio.google.com/app/apikey) em Configurações → Inteligência da casa ' +
                  '(ou defina GEMINI_API_KEY no deploy) — ou digite sua dúvida em texto.',
            },
            { status: 502 },
          );
        }
      } catch (err) {
        console.warn(
          '[api/tutor] transcrição de imagem falhou:',
          err instanceof Error ? err.message : err,
        );
        if (!question) {
          const visionReady = Boolean(
            geminiCfg.key || process.env.OPENROUTER_API_KEY || ZAI_PUBLIC.key || localSdkConfigured(),
          );
          return Response.json(
            {
              error: visionReady
                ? 'A leitura de imagem falhou agora. Tente de novo em instantes ou digite sua dúvida em texto.'
                : 'Leitura de imagem ainda não configurada neste deploy. Dono: cole a key grátis do ' +
                  'Gemini (aistudio.google.com/app/apikey) em Configurações → Inteligência da casa ' +
                  '(ou defina GEMINI_API_KEY no deploy) — ou digite sua dúvida em texto.',
            },
            { status: 502 },
          );
        }
        // com texto digitado, segue sem a imagem
      }
    }

    const history: ChatMessage[] =
      !isFlashcardsMode && !isFeynmanMode && Array.isArray(body.history)
        ? body.history
            .filter(
              (m): m is ChatMessage =>
                !!m &&
                (m.role === 'user' || m.role === 'assistant') &&
                typeof m.content === 'string' &&
                m.content.trim().length > 0,
            )
            .slice(-MAX_HISTORY)
            .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }))
        : [];

    // Sanitiza o contexto do Hub (o front manda; aqui só confiamos em campos tipados)
    const hub =
      !isFlashcardsMode && !isFeynmanMode && body.hubContext && typeof body.hubContext === 'object'
        ? body.hubContext
        : undefined;

    // Contexto do aluno: estado ao vivo ENVIADO PELO APP do cliente nesta chamada
    // (ritmo, consistência) — usado na resposta e descartado. Nada pessoal é lido
    // do servidor nem nele fica.
    const studentContext =
      typeof body.studentContext === 'string' && body.studentContext.trim()
        ? body.studentContext.trim().slice(0, 1600)
        : '';

    // Dados pessoais fora do servidor: persist:false → NENHUMA gravação no banco.
    // O app v2 manda false (a thread vive no IndexedDB do aluno); a casa antiga
    // (/?legacy=1) não manda e mantém a memória do servidor que sempre teve.
    const shouldPersist = body.persist !== false;

    // A BASE DO CURSO é do servidor: institucional, oficial e COMPUTADA AGORA —
    // calendário, semana letiva, próximas avaliações e agenda com dias restantes
    // reais. Prova que passou some sozinha (fim do "vilão silencioso" das datas
    // congeladas). Nada pessoal entra aqui.
    const courseBase = buildCourseBaseContext();

    // Conteúdo REAL do material aberto (resumo IA + trechos do PDF por relevância).
    // FALLBACK 139: sem material selecionado, o tutor PROCURA na disciplina —
    // pergunta com número de questão/tema específico ancora no material certo em
    // vez de responder sem fonte (a matriz inventada da 139 nasceu daí).
    const materialEntry = !isFlashcardsMode
      ? (findMaterial(body.materialId || material) ??
        (await findBestMaterialForQuestion(disciplineKey, effectiveQuestion)))
      : undefined;
    const materialBlock = materialEntry
      ? await buildMaterialBlock(materialEntry, effectiveQuestion)
      : '';

    const systemPrompt = isFlashcardsMode
      ? buildFlashcardsPrompt(
          discipline,
          topic || question,
          [buildCourseBaseShort(), studentContext].filter(Boolean).join(' '),
        )
      : isFeynmanMode
        ? buildFeynmanPrompt(discipline, topic || question) +
          (materialBlock
            ? `\n\n=== TRECHO OFICIAL DO MATERIAL (fonte da verdade) ===\n${materialBlock}\n=== FIM DO TRECHO ===`
            : '')
        : buildSystemPrompt(
            discipline,
            topic,
            material,
            hub,
            materialBlock,
            body.hintMode === true,
            studentContext,
            courseBase,
          );

    // ---------- MODO STREAMING (SSE) — chat do tutor ----------
    if (useStream) {
      const apiKeyStream = process.env.OPENROUTER_API_KEY;
      const zaiPubStream = ZAI_PUBLIC.key;
      const hasAnyKeyStream = Boolean(geminiCfg.key || apiKeyStream || zaiPubStream);
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const enc = new TextEncoder();
          let closed = false;
          const send = (obj: unknown) => {
            if (closed) return;
            try {
              controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
            } catch {
              // client desconectou — o finally fecha
            }
          };

          let answer = '';
          let usedModel = '';
          // orçamento total: função serverless na Vercel (hobby) tem limite ~60s
          const deadline = Date.now() + 55_000;

          try {
            // 0º: Gemini (chave salva na casa → env; visão nativa + matemática forte)
            const gKeyStream = geminiCfg.key;
            if (gKeyStream) {
              for (const model of geminiCfg.model) {
                if (answer || Date.now() > deadline - 8_000) break;
                const t0 = Date.now();
                try {
                  answer = await callGemini(
                    model,
                    gKeyStream,
                    systemPrompt,
                    history,
                    effectiveQuestion,
                    (piece) => send({ t: 'delta', v: piece }),
                  );
                  usedModel = prettyModelName(model);
                  console.log(`[api/tutor] ${model} (stream) → ${Date.now() - t0}ms`);
                } catch (err) {
                  console.warn(
                    `[api/tutor] modelo ${model} falhou (stream) em ${Date.now() - t0}ms:`,
                    err instanceof Error ? err.message : err,
                  );
                }
              }
            }

            // 1º: cadeia OpenRouter em streaming
            if (apiKeyStream) {
              for (const model of MODEL_CHAIN.tutor) {
                if (answer || Date.now() > deadline - 8_000) break;
                const t0 = Date.now();
                try {
                  answer = await callOpenRouter(
                    model,
                    apiKeyStream,
                    systemPrompt,
                    history,
                    effectiveQuestion,
                    (piece) => send({ t: 'delta', v: piece }),
                  );
                  usedModel = prettyModelName(model);
                  console.log(`[api/tutor] ${model} (stream) → ${Date.now() - t0}ms`);
                } catch (err) {
                  console.warn(
                    `[api/tutor] modelo ${model} falhou (stream) em ${Date.now() - t0}ms:`,
                    err instanceof Error ? err.message : err,
                  );
                }
              }
            }

            // 2º: API pública da Z.ai em streaming
            if (!answer && zaiPubStream && Date.now() <= deadline - 8_000) {
              const t0 = Date.now();
              try {
                answer = await callZAIPublic(
                  zaiPubStream,
                  systemPrompt,
                  history,
                  effectiveQuestion,
                  (piece) => send({ t: 'delta', v: piece }),
                );
                usedModel = `Z.ai (${ZAI_PUBLIC.model})`;
                console.log(`[api/tutor] zai-public ${ZAI_PUBLIC.model} (stream) → ${Date.now() - t0}ms`);
              } catch (err) {
                console.warn(
                  `[api/tutor] zai-public falhou (stream) em ${Date.now() - t0}ms:`,
                  err instanceof Error ? err.message : err,
                );
              }
            }
            // 3º: SDK local — credenciais do próprio ambiente (tutor vivo sem key)
            if (!answer && localSdkConfigured() && Date.now() <= deadline - 8_000) {
              const t0 = Date.now();
              try {
                const r = await callLocalSDK(systemPrompt, history, effectiveQuestion, (piece) =>
                  send({ t: 'delta', v: piece }),
                );
                answer = r.text;
                usedModel = r.model;
                console.log(`[api/tutor] sdk-local (stream) → ${Date.now() - t0}ms`);
              } catch (err) {
                console.warn(
                  `[api/tutor] sdk-local falhou (stream) em ${Date.now() - t0}ms:`,
                  err instanceof Error ? err.message : err,
                );
              }
            }


            if (!answer) {
              send({
                t: 'error',
                message: hasAnyKeyStream
                  ? 'O tutor IA está temporariamente indisponível (nenhum provedor respondeu). Tente novamente em instantes.'
                  : 'O tutor IA ainda não tem chave de IA neste deploy. Dono: cole a key grátis do ' +
                    'Gemini (aistudio.google.com/app/apikey) em Configurações → Inteligência da casa ' +
                    '(ou defina GEMINI_API_KEY no deploy) — em seguida o tutor funciona completo, ' +
                    'incluindo leitura de prints.',
              });
              return;
            }

            // normaliza \[..\]/\(..\) → $$..$$/$..$ (KaTeX renderiza)
            answer = normalizeMath(answer);

            // memória: salva a dupla pergunta+resposta (falha aqui não quebra a
            // resposta). persist:false (app v2) = NADA é gravado no servidor.
            if (shouldPersist) {
              try {
                await saveTurn(disciplineKey, savedQuestion, answer, usedModel);
              } catch (err) {
                console.warn('[api/tutor] histórico não salvo:', err instanceof Error ? err.message : err);
              }
            }

            send({ t: 'final', answer, model: usedModel || undefined });
          } catch (err) {
            console.error('[api/tutor] stream erro:', err instanceof Error ? err.message : err);
            send({ t: 'error', message: 'Falha ao consultar o tutor IA. Verifique sua conexão e tente de novo.' });
          } finally {
            closed = true;
            try {
              controller.close();
            } catch {
              // já fechado
            }
          }
        },
      });

      return new Response(stream, { headers: SSE_HEADERS });
    }

    const geminiKey = geminiCfg.key;
    const apiKey = process.env.OPENROUTER_API_KEY;
    const zaiPubKey = ZAI_PUBLIC.key;
    let answer = '';
    let usedModel = '';

    // 0º: Google Gemini (chave salva na casa → env; visão nativa + matemática forte)
    if (geminiKey) {
      for (const model of geminiCfg.model) {
        const t0 = Date.now();
        try {
          answer = await callGemini(model, geminiKey, systemPrompt, history, effectiveQuestion);
          usedModel = prettyModelName(model);
          console.log(`[api/tutor] ${model} → ${Date.now() - t0}ms`);
          break;
        } catch (err) {
          console.warn(
            `[api/tutor] modelo ${model} falhou em ${Date.now() - t0}ms:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    // 1º: cadeia de modelos free da OpenRouter
    if (!answer && apiKey) {
      for (const model of MODEL_CHAIN[isFlashcardsMode ? 'flashcards' : isFeynmanMode ? 'feynman' : 'tutor']) {
        const t0 = Date.now();
        try {
          answer = await callOpenRouter(model, apiKey, systemPrompt, history, effectiveQuestion);
          usedModel = prettyModelName(model);
          console.log(`[api/tutor] ${model} → ${Date.now() - t0}ms`);
          break;
        } catch (err) {
          console.warn(
            `[api/tutor] modelo ${model} falhou em ${Date.now() - t0}ms:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    // 2º: API pública da Z.ai (key própria do dono do app — funciona na Vercel)
    if (!answer && zaiPubKey) {
      const t0 = Date.now();
      try {
        answer = await callZAIPublic(zaiPubKey, systemPrompt, history, effectiveQuestion);
        usedModel = `Z.ai (${ZAI_PUBLIC.model})`;
        console.log(`[api/tutor] zai-public ${ZAI_PUBLIC.model} → ${Date.now() - t0}ms`);
      } catch (err) {
        console.warn(
          `[api/tutor] zai-public falhou em ${Date.now() - t0}ms:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    // 3º: SDK local — credenciais do próprio ambiente (tutor vivo sem key)
    if (!answer && localSdkConfigured()) {
      const t0 = Date.now();
      try {
        const r = await callLocalSDK(systemPrompt, history, effectiveQuestion);
        answer = r.text;
        usedModel = r.model;
        console.log(`[api/tutor] sdk-local → ${Date.now() - t0}ms`);
      } catch (err) {
        console.warn(
          `[api/tutor] sdk-local falhou em ${Date.now() - t0}ms:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    // Normaliza delimitadores que o KaTeX não entende de fábrica (todas as respostas)
    answer = normalizeMath(answer);

    if (!answer) {
      const withVision = Boolean(geminiKey || apiKey || zaiPubKey);
      console.error(
        '[api/tutor] 502: nenhum provedor respondeu. Dono: configure GEMINI_API_KEY (grátis em aistudio.google.com — dá visão + texto) ou OPENROUTER_API_KEY (openrouter.ai, grátis).',
      );
      return Response.json(
        {
          error: withVision
            ? 'O tutor IA está sobrecarregado agora (muitas perguntas em pouco tempo). ' +
              'Aguarde ~1 minuto e tente de novo — volta rapidinho.'
            : 'O tutor IA ainda não tem chave de IA neste deploy. Dono: cole a key grátis do ' +
              'Gemini (aistudio.google.com/app/apikey) em Configurações → Inteligência da casa ' +
              '(ou defina GEMINI_API_KEY no deploy) — em seguida o tutor funciona completo, ' +
              'incluindo leitura de prints.',
        },
        { status: 502 },
      );
    }

    // memória: salva a dupla pergunta+resposta (JSON — flashcards e feynman não
    // persistem). persist:false (app v2) = NADA é gravado no servidor.
    if (shouldPersist && !isFlashcardsMode && !isFeynmanMode) {
      try {
        await saveTurn(disciplineKey, savedQuestion, answer, usedModel);
      } catch (err) {
        console.warn('[api/tutor] histórico não salvo:', err instanceof Error ? err.message : err);
      }
    }

    return Response.json({ answer, model: usedModel || undefined });
  } catch (err) {
    console.error('[api/tutor] erro:', err instanceof Error ? err.message : err);
    return Response.json(
      { error: 'Falha ao consultar o tutor IA. Verifique sua conexão e tente de novo.' },
      { status: 500 },
    );
  }
}

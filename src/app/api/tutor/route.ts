// /api/tutor — Tutor IA + gerador de flashcards
//
// Cadeia de provedores (primeiro disponível responde):
//
//  1º Google Gemini (se GEMINI_API_KEY)    — RECOMENDADO: key grátis no AI Studio
//                                            (aistudio.google.com/app/apikey, sem cartão),
//                                            tier grátis com VISÃO nativa + forte em matemática/LaTeX.
//                                            Resolve texto E leitura de print na Vercel.
//  2º OpenRouter (se OPENROUTER_API_KEY)   — 1 key grátis → dezenas de modelos free (texto + visão)
//  3º Z.ai público (se ZAI_API_KEY)        — API oficial api.z.ai (ex.: glm-4.5-flash, tem tier grátis)
//  4º SDK Z-AI do sandbox (dinâmico)       — funciona só em dev/sandbox (baseUrl interno),
//                                            na Vercel falha silenciosamente e é ignorado
//
// Configure no .env local e nas Environment Variables da Vercel — UMA key já ativa tudo;
// GEMINI_API_KEY é a única que dá leitura de imagem + texto com UMA key só.
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
import { buildMaterialBlock, findMaterial } from '@/lib/material-retrieval';
import { normalizeMath } from '@/lib/sanitize-latex';
import { CURRENT_PERIOD_LABEL, CURRENT_PERIOD_LOWER, tutorCourseContext } from '@/lib/curriculum';

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
 */
const GEMINI = {
  get key() {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  },
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  // ALIASES "-latest": acompanham sempre a versão GA disponível para a key.
  // (26/09/2026) versões fixas gemini-2.5-flash-lite/-flash retornam 404
  // "no longer available to new users" para keys novas — aliases nunca.
  // flash-lite primeiro: limite free mais generoso; flash é o plano B.
  models: process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL]
    : ['gemini-flash-lite-latest', 'gemini-flash-latest'],
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
function visionProviderLabel(): string | null {
  if (GEMINI.key) return 'Gemini (key grátis do AI Studio)';
  if (process.env.OPENROUTER_API_KEY) return 'OpenRouter (modelos free de visão)';
  if (ZAI_PUBLIC.key) return `Z.ai (${process.env.ZAI_VISION_MODEL || 'glm-4.5v'})`;
  return null; // sandbox SDK cobre o dev; na Vercel = sem visão
}

function buildFlashcardsPrompt(discipline: string, topic: string): string {
  return [
    `Você cria flashcards de revisão espaçada para um aluno do ${CURRENT_PERIOD_LOWER} no IFPB, na disciplina ${discipline}.`,
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
    '## 🎯 Pontuação: X/100',
    '(uma linha justificando a nota)',
    '## ✅ O que você acertou',
    '- (itens concretos; se nada, escreva "Nada ainda — mas vamos construir juntos.")',
    '## ⚠️ Lacunas detectadas',
    '- (conceitos importantes do tema que faltaram na explicação)',
    '## 🔧 Correções necessárias',
    '- (erros técnicos ou imprecisões, com a versão correta)',
    '## 💬 Sua ideia em uma frase',
    '(reescreva a ideia central do aluno de forma precisa e simples)',
    '## 🚀 Próximo passo',
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
    lines.push(`- Semana atual do semestre: ${hub.week}${tw} (letivo 24/08/2026 → 18/12, pausa 19/12→17/01, retoma 18/01/2027, termina 30/01/2027)`);
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
): string {
  return [
    `Você é o tutor IA do Hub de Estudos — o app de estudos de um aluno do ${CURRENT_PERIOD_LOWER} no IFPB Campus Cajazeiras, turma 2026.2. Você conversa em português brasileiro.`,
    tutorCourseContext(),
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
    'COMO ESTRUTURAR AS RESPOSTAS (markdown):',
    '- Abra com a resposta direta à pergunta (1-2 frases). Depois explique com um exemplo.',
    '- Use **negrito** para conceitos-chave e listas numeradas para passos.',
    '- Código e pseudocódigo SEMPRE em bloco de código (```); fórmulas matemáticas NÃO — elas vão direto no markdown em LaTeX.',
    '- MATEMÁTICA EM LATEX (o app renderiza KaTeX — use SEMPRE que aparecer matemática): inline com $...$ (ex.: $A^{-1}$, $a_{12} = 5$); blocos com $$...$$; matrizes com \begin{pmatrix} … \end{pmatrix}; frações com \frac{a}{b}; raízes com \sqrt{x}; multiplicação com \cdot. Ex.: $$A \cdot A^{-1} = I_2$$. PROIBIDO: delimitadores \( \) e \[ \]; matriz desenhada em texto corrido ([ 1 2 / 3 4 ]); fórmula complexa em texto simples quando pode ser LaTeX ($\frac{1}{|A|}$ em vez de 1/|A|).',
    '- EXEMPLOS DE CÓDIGO: em C, sempre (é a linguagem do curso desde o início). Pseudocódigo Portugol (ALGORITMO / VAR / INICIO / LEIA / ESCREVA / SE … ENTAO / ENQUANTO … FACA) só para explicar a LÓGICA abstrata ANTES do código, ou se o aluno pedir explicitamente.',
    '- CÓDIGO C ORGANIZADO (toda vez): bloco com a marcação ```c; indentação de 4 espaços (NUNCA tabulação); uma instrução por linha; chave abre na mesma linha da estrutura (if/for/while); nomes descritivos em português (mediaFinal, contadorAlunos, somaNotas) — nada de a, x, t sem sentido; comentário curto em PT-BR só onde ajuda; alinhamento vertical em atribuições repetidas quando melhorar a leitura. Programa pedido pelo aluno = código COMPLETO e compilável (#include no topo, int main, return 0).',
    '- ATIVIDADES/EXERCÍCIOS PROPOSTOS (formato fixo e legível): "Exercício." + enunciado curto em 1-2 frases; se houver entrada/saída, mostre "Entrada:" e "Saída esperada:" cada uma em bloco de código separado (sem marcação de linguagem); depois "Dica:" em UMA linha; por fim "Como conferir:" com o teste que valida a resposta. Vários exercícios? Numere (1., 2., 3.) e limite a 3.',
    '- Feche com um próximo passo prático (mini-exercício ou conexão com o material/prova).',
    '- Máximo ~350 palavras. 1 ou 2 emojis no máximo. Tom acolhedor de tutor particular.',
    '- DATAS OFICIAIS OBRIGATÓRIAS: ao falar de prova, entrega ou atividade que tenha data na BASE DE CONHECIMENTO ou no CONTEXTO DO HUB, cite a data (dd/mm) na resposta — nunca descreva formato/conteúdo de uma avaliação sem a data quando ela existe.',
    '- NÚMEROS SÃO OBRIGATÓRIOS: se a pergunta pede dados/resultados e o material fornecido ou a base tem números (amostra, %, valores de tabela), cite-os LITERALMENTE na resposta — resposta só qualitativa quando os números existem = reprovada.',
    '',
    'STACK DE PRÁTICA DO CURSO (trate como fato quando perguntarem de linguagens):',
    '- O curso é 100% em C DESDE O INÍCIO: os primeiros programas já são escritos em C, compilados com gcc (terminal Linux, VS Code ou Replit — a rotina do Hub tem até "Revisão de C").',
    '- Portugol apareceu APENAS como pseudocódigo introdutório para lógica — NUNCA diga que "a disciplina é em Portugol" ou que C "vem depois". Quem disser isso está desatualizado.',
    '- Linguagens de Marcação usa HTML (estrutura) e CSS (estilo) no projeto prático.',
    '- Detalhe curricular além disso (qual unidade usa qual recurso): SÓ afirme se estiver no CONTEXTO DO HUB. Caso contrário, diga o que sabe do stack e que o professor (cite-o se estiver no contexto) confirmará os detalhes.',
    '',
    'BASE DE CONHECIMENTO DO CONTEÚDO (dos materiais reais do Hub — use para respostas ESPECÍFICAS; não invente além disso):',
    '- Ao citar caminhos, nomes de arquivos e exemplos destes materiais, use EXATAMENTE os nomes originais (ex.: ../imagens/foto.jpg com "imagens", não "images").',
    '- LM/HTML Hyperlinks: elemento <a> com atributo href (Hypertext Reference) cria o link para qualquer recurso da web; atributo title adiciona informações úteis sobre o destino; links podem apontar para partes específicas de um documento.',
    '- LM/HTML URLs e caminhos: URL define onde algo está na web (ex.: https://www.ifpb.edu.br). Mesmo diretório = só o nome (contato.html); descer em subdiretório = dir/arquivo (equipe/equipe.html); subir um nível = ../ (../imagens/foto.jpg); combine vários ../ se preciso, mas prefira simplicidade. index.html é a página de entrada e pode existir em múltiplos diretórios.',
    '- LM/HTML Imagens: <img> é elemento VAZIO (sem fechamento); src obrigatório (caminho relativo ou absoluto, regras iguais às do href); alt = descrição textual (imagem que não carrega/acessibilidade); teste do alt: errar o nome do arquivo de propósito; escreva o alt pensando no que se perde sem a imagem.',
    '- LM/HTML Áudio: <audio src="musica.mp3"> com <p> interno como fallback para navegadores antigos; formatos .mp3/.ogg (teste em vários navegadores); atributos: controls (controles visíveis), autoplay (pode ser bloqueado por permissões), loop (repetir).',
    '- LM/HTML Vídeo: <video src="video.mp4" controls autoplay loop> + fallback <p>, mesma sintaxe do áudio; atributo poster = imagem estática exibida antes do vídeo carregar (como as miniaturas do YouTube); vídeos com licença Creative Commons no YouTube.',
    '- Algoritmos (C): temas do semestre — algoritmo/lógica, entrada-processamento-saída, tipos de variáveis, operadores aritméticos/relacionais/lógicos e precedência, condicionais, laços, vetores, matrizes, funções e recursão; compilação com gcc.',
    '- Matemática: matrizes (definição, tipos, operações, transposta, simétrica/antissimétrica, inversa com teste A·A⁻¹ = I) e lógica proposicional (proposição, negação, conjunção ∧, disjunção ∨, condicional →, bicondicional ↔, tabelas-verdade, argumentos). Determinantes e sistemas lineares AINDA NÃO foram dados — não recomende como conteúdo da Av1.',
    '- FREQUÊNCIA (post oficial do prof. Fábio no Classroom): aprovação exige frequência mínima de 75%; o professor NÃO abona faltas em hipótese alguma. Justificativas de falta vão para a coordenação do curso com o tema "Justificativa de falta" (aulas normais) ou "Realização de segunda chamada" (dias de avaliação).',
    '- "Questões da Semana": bateria semanal de exercícios do prof. Fábio no Classroom (Semana 1 = 8 questões de entrada/saída em C: antecessor/sucessor, área, temperatura, velocidade, polegadas, seno/cosseno, terreno, PA; Semana 2 = 10 questões: conta de restaurante com taxa de serviço de 10% + couvert de R$ 10,00, tabuada com laço no formato "i X n = r", percentual de acertos/erros, distância euclidiana sqrt((x1-x2)²+(y1-y2)²), percentual de votos de 3 candidatos, tempo de download MB/taxa KB/s com 1 MB = 1024 KB em X horas Y minutos Z segundos, salário com hora extra de 50% acima de 160h, conta de luz com R$ 0,35/KWh + ICMS 17% + iluminação pública R$ 15,00, financiamento em 5 prestações com 1ª = 20% e demais = anterior × 1.07, e aeroporto com 5 guichês e check-ins de 15 min usando módulo). Estão no Hub (Biblioteca e Praticar) — recomende resolvê-las quando o aluno perguntar o que praticar.',
    '- MONITORIA de Algoritmos (anúncio oficial do monitor Everton no Classroom): Sessão de Tira-Dúvidas toda SEGUNDA-FEIRA, das 19:00 às 21:00, e Resolução de Questões da Semana toda QUARTA-FEIRA, das 19:00 às 21:00. Os atendimentos são realizados no servidor da monitoria no Discord (discord.gg/XyTmDhE5Dt — link na Biblioteca do Hub) e é preciso entrar no servidor para acompanhar anúncios e formas de contato.',
    '- PROGRAMAS C DO AUTOR (material "Programas C do autor" na Biblioteca, enviado pelo próprio aluno em 19/09): 19 programas .c resolvidos e compilados — 10 da prática de aula (média de notas, círculo com const PI, perímetro, hipotenusa pow/sqrt, raiz/cubo, ASCII ida-e-volta, minúscula→maiúscula com −32) + as 9 questões da Semana 1 completas. PROVA de que a Semana 1 está dominada. BUG conhecido no antecessor_e_sucessor.c: scanf("%c", &numero) e printf com %c em vez de %d (o Hub tem o exercício "Encontre o bug" = alg-aut-q1). Ao corrigir código do aluno, elogie a técnica do reverso.c (decomposição / e %) e aponte o %c→%d como revisão.',
    '- LM/HTML Formulários (aula 06 + apostila): formulários são o principal ponto de interação entre usuário e site — enviam dados (na maior parte do tempo para um servidor). Todo formulário: <form action="/pagina-processa-dados" method="post"> ... </form>; action = para onde os dados vão (obrigatório na apostila); method: GET para buscas/informações não sensíveis, POST para dados sensíveis/confidenciais. O elemento mais importante é o <input>, e o atributo type define a informação: text, email, date, tel, url, search, password. <label for="email"> vincula a descrição ao campo com id="email". <select name="carros"> com <option value="bmw">BMW</option> = drop-down. <textarea name="message"> = várias linhas (texto entre as tags é valor inicial). Botões: submit (envia; sem type DENTRO de um form é submit por padrão), reset (restaura os valores iniciais) e button (genérico, ações via JavaScript — aceita tags dentro, diferente de <input>). Checáveis: Checkbox e Radio Button; no radio TODOS os names iguais formam um grupo exclusivo. Boas práticas do professor: cada campo em uma <div> e cada campo com <label> associada. Exemplo da aula (index.html na Biblioteca do Hub) tem tudo isso com turnos em radio e necessidades especiais em checkbox. PRÁTICA oficial: pedido de pizza (select de sabor + number, radio de tamanho, checkboxes de adicionais, select de bebida + number, textarea de endereço, reset + submit) — está no Praticar. Para a página de contato do projeto A1: crie conta no Formspree e aponte o action para ele.',
    '- LM/HTML Metadados (aula 07, 24/09 + apostila): metadados = dados sobre dados — informações sobre a própria informação que descrevem características de uma fonte; moram no <head> (invisíveis ao leitor; o <body> é o que aparece). Pegadinha clássica: <h1> aparece NA página (1 vez por página, título do conteúdo — história/notícia); <title> é metadado que representa o título de TODO o documento (aparece na aba do navegador, no resultado do Google e no leitor de tela — e é dispensado dependendo do contexto, pois não faz parte do corpo). <meta> é a maneira oficial de adicionar metadados: <meta charset="utf-8"> define a codificação (utf-8 é universal, inclui acentos de qualquer língua); muitos <meta> usam o par name (tipo de informação) + content (valor real): author, description (descrição concisa que buscadores exibem) e keywords (palavras-chave do site — encher de palavras sem relação NÃO funciona, o Google detecta). Favicon = ícone ~16×16 px da aba, entra com <link rel="shortcut icon" href="favicon.png" type="image/x-icon"> (a tag <link> liga o documento a recursos externos: CSS, ícones — CSS é o próximo módulo). Metadados alimentam integrações: Open Graph Protocol do Facebook e cards do Twitter criam o preview de um link compartilhado; metatags.io gera e visualiza metadados para várias redes. PRÁTICA da aula: criar página sobre tema livre com charset, author, description, keywords, title + uma imagem como ícone.',
    '- LM — PROJETO 1ª ETAPA (Classroom, 24/09, prof. Diogo; VALE 100 pontos): proposta para um website sobre um tema de escolha do GRUPO — equipes de ATÉ 4 pessoas, FIXAS até o fim do semestre. ENTREGA 09/10 e apresentação em sala NO dia da entrega (responder no Classroom com os slides; ~5 minutos e OBRIGATÓRIO nome de todos os integrantes). A proposta deve conter: (1) Nome do website (nome próprio, como marca); (2) Tema (ex.: filmes, animais de estimação, entidade pública, evento); (3) Potenciais interessados / stakeholders (quem acessaria o conteúdo? quem se interessa?); (4) Tópicos abordados — MÍNIMO 6 (tópicos geralmente viram páginas do site; ex.: site de jogos → jogos de corrida, jogos casuais...). É a 1ª etapa do projeto A1 (estrutura HTML, peso 45%). Ajude a definir tema/nome/tópicos e a ensaiar a apresentação.',
    '- Inglês Instrumental — vídeo indicado pelo prof. Fernando Van Woensel (Classroom, 16/09): "15 partes do corpo que também são VERBOS?!" (YouTube, 16 min, na Biblioteca do Hub) — partes do corpo em inglês que também funcionam como verbos com outro significado (fenômeno comum: hand/entregar, eye/observar, head/liderar são exemplos clássicos do tema). Sugira anotar os pares substantivo/verbo no glossário pessoal.',
    '- PROVA DE ALGORITMOS — Prova 1, SEXTA-FEIRA 30/10/2026 (formato confirmado pelo dono em 24/09): 3 QUESTÕES — uma FÁCIL, uma MÉDIA e uma DIFÍCIL — valendo 33,3% da média (0-100, aprovação ≥ 70). Os programas PODEM VIR da Lista de Exercícios da disciplina (289 questões, no Hub: seções Q1–57 entrada/saída, Q58–97 desvios condicionais, Q98–157 repetição, Q158–208 vetores/matrizes, Q209–289 subprogramas/ponteiros). Escopo da Prova 1 = Unidades 1 e 2 → as seções Q1–97 da Lista são o treino mais direto. Estratégia: dominar as Semanas 1–3 do Classroom (S1 já feita pelo aluno; S2 e S3 pendentes) e depois atacar a Lista nas seções 1 e 2. Questões típicas da lista: médias, conversões, processamento de dígitos, maior de N valores, validações com if/else.',
    '- RHT — ARTIGO TELETRABALHO (profa. Marília, Classroom 15/09, base da PROPOSTA DE ATIVIDADE I; material na Biblioteca): Vilarinho, Paschoal e Demo (RSP 72(1), 2021) estudam o teletrabalho no Serpro (pioneiro: Projeto-Lar 1985, piloto 2005, Lei 12.551/2011). Método: estudo de caso único, transversal, quali+quanti (Iramuteq, ANOVA, Mann-Whitney); amostra 45 teletrabalhadores + 62 colegas + 23 chefias. Positivos: produtividade e qualidade de vida; Negativos: dificuldades técnicas e convívio/isolamento social; teletrabalhadores ainda relatam preconceito/desconfiança de chefes e colegas. Tabela 1: teletrabalhadores avaliaram MELHOR que colegas TODAS as variáveis (ex.: afeto positivo 8,00 vs. 6,16; afeto negativo 2,01 vs. 3,88). Cuidados: dados pré-pandemia; estudo transversal = associação, NÃO causalidade; os % dos quadros representam o discurso do grupo, não nº de respondentes. REGRA DE OURO deste estudo: QUALQUER resposta sobre os resultados/método/amostra DEVE citar TODOS OS TRÊS números da amostra — 45 teletrabalhadores, 62 colegas e 23 chefias (um a um, na resposta) — e pelo menos um valor da Tabela 1; citar só 45/62 sem o 23 = resposta incompleta. Ajude o aluno a preparar a atividade com esses dados exatos.',
    '',
    'PROVA DE MATEMÁTICA — Av1, QUARTA-FEIRA 01/10/2026 (data confirmada pelo dono; FONTE DA VERDADE: card "Foco: Prova de Matemática" no Painel do Hub):',
    '- Programa da Av1 (ATUALIZADO 24/09, correção do dono): Matrizes como NÚCLEO — definição/tipos, soma e escalar, multiplicação e não-comutatividade, transposta, simétrica/antissimétrica, inversa com teste A·A⁻¹ = I (Q31–35 da lista) + Lógica proposicional — proposições, conectivos, tabelas-verdade, tautologia/contradição, De Morgan, Modus Ponens/Tollens e argumentos (a Lista de Lógica tem os encadeamentos estilo múltipla escolha). NÃO CAEM: determinantes (tópico 1.3) e sistemas lineares (1.4) — o professor ainda não deu; se perguntarem, explique que são pós-prova.',
    '- A prova vale 33,3% da média (escala 0-100, aprovação ≥ 70). Peso do estudar BEM matrizes: é o conteúdo central.',
    '- O Hub tem um PLANO D-7 REFEITO (24/09, pedido do dono) no card do Painel, centrado em RESOLVER AS LISTAS impressas (ele só leu/assistiu até agora): Lista de Matrizes em 3 blocos (Q1–16 · Q17–30 · Q31–35) → Lista de Lógica em 2 partes (Q1–12 · Q13–18) → simulado 29/09 → véspera 30/09. ORDEM DAS LISTAS: Matrizes PRIMEIRO (núcleo/conteúdo novo), Lógica depois. Teoria (Aula 00 + slides de Lógica) só como consulta. Quando o aluno perguntar o que estudar, aponte o dia atual do plano.',
    '- MODO RECUPERAÇÃO (24/09): o plano antigo confundiu o aluno — foi REFEITO centrado em resolver as listas. Se perguntarem a ordem: Lista de Matrizes Q1–16 → Q17–30 → Q31–35 → Lista de Lógica Q1–12 → Q13–18 → simulado 29/09 → revisão 30/09. Card "Plano de Recuperação": Matemática (P0) → Algoritmos Semanas 2/3 + Lista Q1–97 (P1) → LM Metadados + Projeto 1ª etapa entrega 09/10 (P2) → Inglês vídeo (P3) → Fundamentos 1 questão/semana (P4) → RHT ADIADO até 02/10 (P5, sem prova marcada).',
    '- Simulado da Prova: botão no card do Painel abre o Simulado Pro já configurado (10 questões de Matemática, 60 min, só conteúdo em sala). As 12 questões novas (mat-ex01 a mat-ex12) vêm EXCLUSIVAMENTE dos materiais reais — mat-ex05 (determinantes) e mat-ex06 (sistemas lineares) só liberam PÓS-PROVA.',
    '',
    'POLÍTICA MATERIAL-FIRST DO ACERVO (importante para recomendar prática):',
    '- O acervo do Hub se alinha automaticamente ao que a turma já viu: exercícios de tópicos ainda NÃO dados em aula ficam ocultos por padrão ("futuros") até material novo comprovar a aula.',
    '- Para Matemática: só recomende o que está nos 4 materiais (matrizes + lógica). NÃO recomende exercícios de Conjuntos/Funções como conteúdo da prova — são unidades futuras (Av3).',
    '- Para Algoritmos: entrada/saída, condicionais e laços estão "em sala"; vetores, modularização e recursividade são FUTUROS (provas 2 e 3). Se o aluno pedir para se adiantar, tudo bem — mas avise que está à frente da turma.',
    '- Se o aluno disser que "uma questão nunca foi vista em sala": provavelmente é um exercício futuro com o modo "Mostrar futuros" ligado — explique o padrão e redirecione para o material correspondente.',
    '',
    'O QUE VOCÊ PODE E COMO AGIR:',
    '- Perguntas sobre o próprio Hub ou a turma (professor, datas de prova, calendário, progresso do aluno, como usar o app): responda com precisão usando o CONTEXTO DO HUB. NUNCA diga que "não tem acesso" ao que está listado ali.',
    '- Perguntas sobre DATAS: só confirme o que está em "Próximas avaliações COM DATA OFICIAL" (Av1 de Matemática 01/10, Projeto LM 1ª etapa 09/10 e Prova 1 de Algoritmos 30/10). Para as demais avaliações (Av de Fundamentos, A2/A3 de LM, seminário, N1/N2), diga que a data ainda não foi divulgada e sugira confirmar com o professor/SUAP — NUNCA estime semana ou prazo (estimativa engana o aluno).',
    '- SOBRE PESSOAS REAIS (professor, colegas): cite APENAS o que está no CONTEXTO DO HUB (nome, título, carga horária). NUNCA invente biografia, pesquisas, experiências ou opiniões que não estejam ali.',
    '- Dúvidas do conteúdo da disciplina: sua prioridade. Conecte com o tópico/material atual quando fizer sentido.',
    '- CONTINUIDADE DA CONVERSA (crítico): o HISTÓRICO DA CONVERSA traz as mensagens anteriores. Se a mensagem atual for continuação ("e isso?", "por quê?", "não entendi", "e a questão 2?", "outro exemplo", "continua"), conecte com o que você já respondeu e CONTINUE o raciocínio — NÃO trate como pergunta solta, NÃO mude de assunto, NÃO re-explique do zero. Refira-se naturalmente ao que foi dito antes ("como mostrei acima…"). Só trate como tópico novo se ela realmente introduzir um assunto diferente.',
    '- IMAGENS ANEXADAS: quando a pergunta trouxer o bloco "IMAGEM ANEXADA" (transcrição do print/foto), trate-o como a questão LITERAL do aluno — resolva com base nele, citando os números exatos da transcrição. Se a transcrição estiver incompleta ou ambígua, diga o que faltou e pergunte ao aluno.',
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

/** Fallback final: SDK Z-AI — import dinâmico protegido p/ portabilidade (Vercel-safe).
 *  Com onDelta tenta stream:true; se o backend não iterar, entrega inteiro — nunca quebra. */
async function callZAI(
  systemPrompt: string,
  history: ChatMessage[],
  question: string,
  onDelta?: (piece: string) => void,
): Promise<string> {
  // new Function impede o bundler de resolver o pacote no build — se não existir
  // no ambiente (ex.: deploy na Vercel), cai no catch e devolve '' sem erro.
  const dynamicImport = new Function("return import('z-ai-web-dev-sdk')") as () => Promise<any>;
  const mod = await dynamicImport();
  const ZAI = mod.default;
  const zai = await ZAI.create();
  const messages = [
    { role: 'assistant', content: systemPrompt },
    ...history,
    { role: 'user', content: question },
  ];

  if (!onDelta) {
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    });
    return completion.choices[0]?.message?.content?.trim() ?? '';
  }

  // tentativa de streaming (o tipo é Promise<any> — testamos iterabilidade)
  try {
    const completion = await zai.chat.completions.create({
      messages,
      stream: true,
      thinking: { type: 'disabled' },
    });
    if (completion && typeof completion[Symbol.asyncIterator] === 'function') {
      let full = '';
      for await (const chunk of completion) {
        // Formato 1: delta OpenAI-like direto no chunk
        const direct =
          chunk?.choices?.[0]?.delta?.content ?? chunk?.choices?.[0]?.message?.content;
        if (typeof direct === 'string' && direct) {
          full += direct;
          onDelta(direct);
          continue;
        }
        // Formato 2 (sandbox): string SSE crua — "data: {json}\n\n"
        const raw =
          typeof chunk === 'string' ? chunk : chunk instanceof String ? String(chunk) : '';
        if (!raw) continue;
        for (const line of raw.split('\n')) {
          const l = line.trim();
          if (!l.startsWith('data:')) continue;
          const payload = l.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload) as {
              choices?: { delta?: { content?: string }; message?: { content?: string } }[];
            };
            const piece =
              json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? '';
            if (piece) {
              full += piece;
              onDelta(piece);
            }
          } catch {
            // linha parcial — ignora
          }
        }
      }
      if (!full.trim()) throw new Error('stream vazio');
      return full.trim();
    }
  } catch (err) {
    console.warn('[api/tutor] ZAI stream indisponível — usando resposta inteira:',
      err instanceof Error ? err.message : err);
  }

  // caminho seguro: resposta completa em um único delta
  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: 'disabled' },
  });
  const full = completion.choices[0]?.message?.content?.trim() ?? '';
  if (!full) throw new Error('resposta vazia');
  onDelta(full);
  return full;
}

/** Z-AI com retry + backoff — sob rajadas (429 Too many requests) tenta até 3x
 *  antes de desistir, evitando 502 para o aluno quando a OpenRouter também
 *  está limitando. Total extra no pior caso: ~3,7s. */
async function callZAIRetry(
  systemPrompt: string,
  history: ChatMessage[],
  question: string,
  onDelta?: (piece: string) => void,
): Promise<string> {
  const backoffMs = [0, 1200, 2500];
  let lastErr: unknown;
  for (const delay of backoffMs) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      const answer = await callZAI(systemPrompt, history, question, onDelta);
      if (answer) return answer;
      lastErr = new Error('resposta vazia');
    } catch (err) {
      lastErr = err;
      console.warn('[api/tutor] ZAI tentativa falhou (retry em sequência):', err instanceof Error ? err.message : err);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('ZAI esgotou as retentativas');
}

/**
 * Transcreve a imagem anexada (print/foto da questão) com o PRIMEIRO modelo de
 * visão disponível — cadeia pensada para funcionar 100% na Vercel com keys grátis:
 *
 *  1º Gemini (GEMINI_API_KEY)      — visão nativa, tier grátis generoso (RECOMENDADO)
 *  2º OpenRouter (OPENROUTER_API_KEY) — modelos free que aceitam imagem
 *  3º Z.ai público (ZAI_API_KEY)   — glm-4.5v via api.z.ai
 *  4º SDK Z-AI do sandbox          — só em dev/sandbox (na Vercel não existe)
 *
 * A transcrição vira a "pergunta efetiva" — assim qualquer provedor de TEXTO da
 * cadeia responde com a questão na mão, e ela também entra no retrieval.
 */
async function transcribeImage(dataUrl: string, userNote: string): Promise<string> {
  const instruction = buildTranscriptionInstruction(userNote);
  const errors: string[] = [];

  // 1º — Gemini: 1 key grátis resolve visão + texto na Vercel
  const gKey = GEMINI.key;
  if (gKey) {
    for (const model of GEMINI.models) {
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

  // 4º — SDK do sandbox (dev). Na Vercel o import falha → cai no throw abaixo.
  try {
    const out = await transcribeImageSandbox(dataUrl, userNote);
    if (out) return out;
  } catch (err) {
    errors.push(`sandbox-sdk: ${err instanceof Error ? err.message : err}`);
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

/** Transcrição com o SDK Z-AI do sandbox (glm-4.5v) — só funciona em dev. */
async function transcribeImageSandbox(dataUrl: string, userNote: string): Promise<string> {
  const dynamicImport = new Function("return import('z-ai-web-dev-sdk')") as () => Promise<any>;
  const mod = await dynamicImport();
  const ZAI = mod.default;
  const zai = await ZAI.create();
  const instruction = buildTranscriptionInstruction(userNote);
  const completion = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: instruction },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  return (completion?.choices?.[0]?.message?.content ?? '').trim();
}

/**
 * Diagnóstico (GET ?probe=1): ping REAL de cada provedor com ~10 tokens —
 * mostra nas Configurações se cada key funciona DE VERDADE (não só se existe),
 * com latência e a mensagem de erro exata quando falha (key inválida, quota,
 * região bloqueada…). Custo desprezível no tier grátis.
 */
type ProbeResult = { ok: boolean; ms: number; model?: string; error?: string };

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

async function probeProviders(geminiModelOverride?: string | null): Promise<Response> {
  const jobs: Record<string, Promise<ProbeResult>> = {};

  // — Gemini: generateContent com 10 tokens (mesmo modelo que atende as dúvidas)
  if (GEMINI.key) {
    const key = GEMINI.key;
    // ?probe=1&geminiModel=X testa um modelo específico — descobre o que a key aceita
    const model = geminiModelOverride || GEMINI.models[0];
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
      return { ok: !r.error, ms: r.ms, model: prettyModelName(model) || model, error: r.error };
    })();
  } else {
    jobs.gemini = Promise.resolve({ ok: false, ms: 0, error: 'sem GEMINI_API_KEY' });
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
  const first = gemini.ok ? 'Gemini' : openrouter.ok ? 'OpenRouter' : zai.ok ? 'Z.ai' : 'nenhum (usa sandbox no dev)';
  return Response.json({
    probe: {
      at: new Date().toISOString(),
      firstToAnswer: first,
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
  const vision = visionProviderLabel();
  return Response.json({
    provider: 'gemini → openrouter → z.ai → sandbox (primeiro disponível)',
    vision: vision ?? 'somente dev/sandbox — configure GEMINI_API_KEY (grátis) para produção',
    chains: {
      tutor: MODEL_CHAIN.tutor.map((id) => ({ id, label: prettyModelName(id) })),
      flashcards: MODEL_CHAIN.flashcards.map((id) => ({ id, label: prettyModelName(id) })),
      vision: [
        ...(GEMINI.key ? GEMINI.models.map((id) => ({ id, label: prettyModelName(id) })) : []),
        ...VISION_CHAIN_OPENROUTER.map((id) => ({ id, label: prettyModelName(id) })),
      ],
    },
    providers: {
      gemini: Boolean(GEMINI.key),
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      zaiPublic: Boolean(process.env.ZAI_API_KEY),
      zaiSdk: 'auto (só em dev/sandbox)',
    },
  });
}

/**
 * normalizeMath: normaliza \[...\]/\(...\) para $$...$$/$...$ — o tutor-markdown
 * AGORA renderiza LaTeX com KaTeX, então a matemática segue matemática.
 */

/** Limites da memória por disciplina — economia de armazenamento. */
const HISTORY_KEEP = 40;
const MSG_CAP = 4000;

/** Salva a dupla pergunta+resposta e poda o histórico (mantém as 40 mais novas). */
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

    const imageDataUrl =
      typeof body.imageDataUrl === 'string' &&
      body.imageDataUrl.startsWith('data:image/') &&
      body.imageDataUrl.length <= 8_000_000
        ? body.imageDataUrl
        : undefined;

    if (!question && !imageDataUrl) {
      return Response.json({ error: 'Pergunta vazia.' }, { status: 400 });
    }
    if (question.length > 2000) {
      return Response.json(
        { error: 'Pergunta muito longa (máx. 2000 caracteres).' },
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
            GEMINI.key || process.env.OPENROUTER_API_KEY || ZAI_PUBLIC.key,
          );
          return Response.json(
            {
              error: visionReady
                ? 'Não consegui ler a imagem agora. Tente de novo ou digite sua dúvida em texto.'
                : 'Leitura de imagem ainda não configurada neste deploy. Dono: adicione a key grátis do ' +
                  'Gemini (aistudio.google.com/app/apikey) como GEMINI_API_KEY na Vercel — ou digite sua dúvida em texto.',
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
            GEMINI.key || process.env.OPENROUTER_API_KEY || ZAI_PUBLIC.key,
          );
          return Response.json(
            {
              error: visionReady
                ? 'A leitura de imagem falhou agora. Tente de novo em instantes ou digite sua dúvida em texto.'
                : 'Leitura de imagem ainda não configurada neste deploy. Dono: adicione a key grátis do ' +
                  'Gemini (aistudio.google.com/app/apikey) como GEMINI_API_KEY na Vercel — ou digite sua dúvida em texto.',
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

    // Conteúdo REAL do material aberto (resumo IA + trechos do PDF por relevância)
    const materialEntry = !isFlashcardsMode
      ? findMaterial(body.materialId || material)
      : undefined;
    const materialBlock = materialEntry
      ? await buildMaterialBlock(materialEntry, effectiveQuestion)
      : '';

    const systemPrompt = isFlashcardsMode
      ? buildFlashcardsPrompt(discipline, topic || question)
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
          );

    // ---------- MODO STREAMING (SSE) — chat do tutor ----------
    if (useStream) {
      const apiKeyStream = process.env.OPENROUTER_API_KEY;
      const zaiPubStream = ZAI_PUBLIC.key;
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
            // 0º: Gemini (key grátis do AI Studio — visão nativa + matemática forte)
            const gKeyStream = GEMINI.key;
            if (gKeyStream) {
              for (const model of GEMINI.models) {
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

            // 3º: fallback Z-AI do sandbox (stream se o SDK permitir)
            if (!answer && Date.now() <= deadline - 8_000) {
              try {
                answer = await callZAIRetry(systemPrompt, history, effectiveQuestion, (piece) =>
                  send({ t: 'delta', v: piece }),
                );
                usedModel = 'Z-AI (fallback)';
              } catch (err) {
                console.error('[api/tutor] fallback ZAI falhou:', err instanceof Error ? err.message : err);
              }
            }

            if (!answer) {
              send({
                t: 'error',
                message:
                  'O tutor IA está temporariamente indisponível (nenhum provedor respondeu). Tente novamente em instantes.',
              });
              return;
            }

            // normaliza \[..\]/\(..\) → $$..$$/$..$ (KaTeX renderiza)
            answer = normalizeMath(answer);

            // memória: salva a dupla pergunta+resposta (falha aqui não quebra a resposta)
            try {
              await saveTurn(disciplineKey, savedQuestion, answer, usedModel);
            } catch (err) {
              console.warn('[api/tutor] histórico não salvo:', err instanceof Error ? err.message : err);
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

    const geminiKey = GEMINI.key;
    const apiKey = process.env.OPENROUTER_API_KEY;
    const zaiPubKey = ZAI_PUBLIC.key;
    let answer = '';
    let usedModel = '';

    // 0º: Google Gemini (key grátis do AI Studio — visão nativa + matemática forte)
    if (geminiKey) {
      for (const model of GEMINI.models) {
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

    // 3º: fallback Z-AI do sandbox (com retry — sobrevive a rajadas de 429)
    if (!answer) {
      try {
        answer = await callZAIRetry(systemPrompt, history, effectiveQuestion);
        usedModel = 'Z-AI (fallback)';
      } catch (err) {
        console.error('[api/tutor] fallback ZAI falhou:', err instanceof Error ? err.message : err);
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
              'Aguarde ~1 minuto e tente de novo — volta rapidinho. 💪'
            : 'O tutor IA ainda não tem chave de IA neste deploy. Dono: adicione GEMINI_API_KEY ' +
              '(key grátis em aistudio.google.com/app/apikey) nas variáveis da Vercel — em seguida o tutor ' +
              'funciona completo, incluindo leitura de prints. 💪',
        },
        { status: 502 },
      );
    }

    // memória: salva a dupla pergunta+resposta (JSON — flashcards e feynman não persistem)
    if (!isFlashcardsMode && !isFeynmanMode) {
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

// /api/tutor — Tutor IA + gerador de flashcards
//
// Cadeia de provedores (primeiro disponível responde):
//
//  1º OpenRouter (se OPENROUTER_API_KEY)   — recomendado: 1 key grátis → dezenas de modelos free
//  2º Z.ai público (se ZAI_API_KEY)        — API oficial api.z.ai (ex.: glm-4.5-flash, tem tier grátis)
//  3º SDK Z-AI do sandbox (dinâmico)       — funciona só em dev/sandbox (baseUrl interno),
//                                            na Vercel falha silenciosamente e é ignorado
//
// Configure no .env local e nas Environment Variables da Vercel — UMA das duas keys basta.
// Modelos OpenRouter free verificados:
//  ✅ nvidia/nemotron-3-super-120b-a12b:free  — melhor qualidade/velocidade p/ tutoria PT-BR
//  ✅ nvidia/nemotron-3-ultra-550b-a55b:free  — 550B, mais profundo (mais lento)
//  ✅ nex-agi/nex-n2.5-pro:free               — JSON limpo, ótimo p/ flashcards
//  ✅ inclusionai/ling-3.0-flash-sante:free   — JSON limpo
//  ✅ cohere/north-mini-code:free             — bom p/ dúvidas de código
//  ✅ openrouter/free                         — roteador automático (rede de segurança)
//  ❌ google/gemma-4-31b-it:free              — provider error (removido)
//  ❌ thinkingmachines/inkling:free           — exige harness agentic (removido)

export const runtime = 'nodejs';

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
  topic?: string;
  material?: string;
  history?: ChatMessage[];
  /** 'flashcards' → a resposta deve ser um array JSON de {front, back}. */
  mode?: 'tutor' | 'flashcards';
  /** Dados do app (professor, datas, progresso) para respostas precisas. */
  hubContext?: HubContext;
}

const MAX_HISTORY = 8; // stateless por sessão — leve
const MODEL_TIMEOUT_MS = 35_000; // se um modelo demorar >35s, cai para o próximo

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
const MODEL_CHAIN: Record<'tutor' | 'flashcards', string[]> = {
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
};

/** Nome curto e legível para exibir na UI (remove sufixo :free e vendor). */
function prettyModelName(id: string): string {
  const clean = id.replace(':free', '');
  const map: Record<string, string> = {
    'nvidia/nemotron-3-super-120b-a12b': 'Nemotron 3 Super',
    'nvidia/nemotron-3-ultra-550b-a55b': 'Nemotron 3 Ultra',
    'nex-agi/nex-n2.5-pro': 'Nex N2.5 Pro',
    'inclusionai/ling-3.0-flash-sante': 'Ling 3.0 Flash',
    'openrouter/free': 'OpenRouter Auto',
  };
  return map[clean] ?? clean.split('/').pop() ?? clean;
}

function buildFlashcardsPrompt(discipline: string, topic: string): string {
  return [
    `Você cria flashcards de revisão espaçada para um aluno do 2º período de ADS no IFPB, na disciplina ${discipline}.`,
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
): string {
  return [
    `Você é o tutor IA do Hub de Estudos — o app de estudos de um aluno do 2º período de ADS no IFPB Campus Cajazeiras (ensino médio integrado ao superior), turma 2026.2. Você conversa em português brasileiro.`,
    `Disciplina atual: ${discipline}.`,
    topic ? `Tópico em estudo agora: "${topic}".` : '',
    material ? `Material aberto: "${material}".` : '',
    buildHubBlock(hub),
    'COMO ESTRUTURAR AS RESPOSTAS (markdown):',
    '- Abra com a resposta direta à pergunta (1-2 frases). Depois explique com um exemplo.',
    '- Use **negrito** para conceitos-chave e listas numeradas para passos.',
    '- Código, pseudocódigo e fórmulas SEMPRE em bloco de código (```).',
    '- PROIBIDO usar LaTeX/markdown matemático (cifrão simples ou duplo, colchetes de display math, comandos tipo "frac" ou "begin"): o app não renderiza. Escreva fórmulas em texto simples (ex.: det = a*d - b*c) ou em bloco de código.',
    '- EXEMPLOS DE CÓDIGO: em C, sempre (é a linguagem do curso desde o início). Pseudocódigo Portugol (ALGORITMO / VAR / INICIO / LEIA / ESCREVA / SE … ENTAO / ENQUANTO … FACA) só para explicar a LÓGICA abstrata ANTES do código, ou se o aluno pedir explicitamente.',
    '- CÓDIGO C ORGANIZADO (toda vez): bloco com a marcação ```c; indentação de 4 espaços (NUNCA tabulação); uma instrução por linha; chave abre na mesma linha da estrutura (if/for/while); nomes descritivos em português (mediaFinal, contadorAlunos, somaNotas) — nada de a, x, t sem sentido; comentário curto em PT-BR só onde ajuda; alinhamento vertical em atribuições repetidas quando melhorar a leitura. Programa pedido pelo aluno = código COMPLETO e compilável (#include no topo, int main, return 0).',
    '- ATIVIDADES/EXERCÍCIOS PROPOSTOS (formato fixo e legível): "Exercício." + enunciado curto em 1-2 frases; se houver entrada/saída, mostre "Entrada:" e "Saída esperada:" cada uma em bloco de código separado (sem marcação de linguagem); depois "Dica:" em UMA linha; por fim "Como conferir:" com o teste que valida a resposta. Vários exercícios? Numere (1., 2., 3.) e limite a 3.',
    '- Feche com um próximo passo prático (mini-exercício ou conexão com o material/prova).',
    '- Máximo ~350 palavras. 1 ou 2 emojis no máximo. Tom acolhedor de tutor particular.',
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
    '- Matemática: matrizes (definição, tipos, operações, transposição/inversão, determinante) e lógica proposicional (proposição, negação, conjunção ∧, disjunção ∨, condicional →, bicondicional ↔, tabelas-verdade).',
    '- FREQUÊNCIA (post oficial do prof. Fábio no Classroom): aprovação exige frequência mínima de 75%; o professor NÃO abona faltas em hipótese alguma. Justificativas de falta vão para a coordenação do curso com o tema "Justificativa de falta" (aulas normais) ou "Realização de segunda chamada" (dias de avaliação).',
    '- "Questões da Semana": bateria semanal de exercícios do prof. Fábio no Classroom (Semana 1 = 8 questões de entrada/saída em C: antecessor/sucessor, área, temperatura, velocidade, polegadas, seno/cosseno, terreno, PA). Estão no Hub (Biblioteca e Praticar) — recomende resolvê-las quando o aluno perguntar o que praticar.',
    '',
    'O QUE VOCÊ PODE E COMO AGIR:',
    '- Perguntas sobre o próprio Hub ou a turma (professor, datas de prova, calendário, progresso do aluno, como usar o app): responda com precisão usando o CONTEXTO DO HUB. NUNCA diga que "não tem acesso" ao que está listado ali.',
    '- Perguntas sobre DATAS: só confirme o que está em "Próximas avaliações COM DATA OFICIAL". Para qualquer outra avaliação (Av de Matemática/Fundamentos, A1/A2/A3 de LM, seminário, N1/N2), diga que a data ainda não foi divulgada e sugira confirmar com o professor/SUAP — NUNCA estime semana ou prazo (estimativa engana o aluno).',
    '- SOBRE PESSOAS REAIS (professor, colegas): cite APENAS o que está no CONTEXTO DO HUB (nome, título, carga horária). NUNCA invente biografia, pesquisas, experiências ou opiniões que não estejam ali.',
    '- Dúvidas do conteúdo da disciplina: sua prioridade. Conecte com o tópico/material atual quando fizer sentido.',
    '- Assuntos gerais/paralelos (ferramentas, carreira, curiosidades, esporte, música, cultura pop): você é um TUTOR AMIGO, não um assistente corporativo restrito. Responda de forma BREVE, leve e divertida — se pedirem palpite, dê um com humor e humildade ("sou só uma IA, mas..."). Depois conecte com os estudos (ex.: "agora bora canalizar essa energia num exercício"). PROIBIDO: dizer "meu papel é exclusivamente", "não posso falar sobre isso", "conforme o contexto fornecido" ou dar sermão sobre foco. NUNCA recuse de forma seca.',
    '- Não invente dados institucionais ausentes do contexto (sala, e-mail, notas, plantão). Se pedirem algo que não está lá, diga o que sabe e aponte o canal certo (SUAP, Classroom ou o professor).',
    '- Se não souber um conteúdo específico, admita com honestidade e sugira revisar o material aberto ou o PDF da disciplina.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Chama um modelo da OpenRouter com timeout; retorna o conteúdo ou lança erro. */
async function callOpenRouter(
  model: string,
  apiKey: string,
  systemPrompt: string,
  history: ChatMessage[],
  question: string,
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
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: question },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${detail.slice(0, 200)}`);
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
    clearTimeout(timer);
  }
}

/** Chama a API pública da Z.ai (OpenAI-compatible, api.z.ai/api/paas/v4). */
async function callZAIPublic(
  apiKey: string,
  systemPrompt: string,
  history: ChatMessage[],
  question: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

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
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${detail.slice(0, 200)}`);
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
    clearTimeout(timer);
  }
}

/** Fallback final: SDK Z-AI — import dinâmico protegido p/ portabilidade (Vercel-safe). */
async function callZAI(
  systemPrompt: string,
  history: ChatMessage[],
  question: string,
): Promise<string> {
  // new Function impede o bundler de resolver o pacote no build — se não existir
  // no ambiente (ex.: deploy na Vercel), cai no catch e devolve '' sem erro.
  const dynamicImport = new Function("return import('z-ai-web-dev-sdk')") as () => Promise<any>;
  const mod = await dynamicImport();
  const ZAI = mod.default;
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      ...history,
      { role: 'user', content: question },
    ],
    thinking: { type: 'disabled' },
  });
  return completion.choices[0]?.message?.content?.trim() ?? '';
}

/** Z-AI com retry + backoff — sob rajadas (429 Too many requests) tenta até 3x
 *  antes de desistir, evitando 502 para o aluno quando a OpenRouter também
 *  está limitando. Total extra no pior caso: ~3,7s. */
async function callZAIRetry(
  systemPrompt: string,
  history: ChatMessage[],
  question: string,
): Promise<string> {
  const backoffMs = [0, 1200, 2500];
  let lastErr: unknown;
  for (const delay of backoffMs) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      const answer = await callZAI(systemPrompt, history, question);
      if (answer) return answer;
      lastErr = new Error('resposta vazia');
    } catch (err) {
      lastErr = err;
      console.warn('[api/tutor] ZAI tentativa falhou (retry em sequência):', err instanceof Error ? err.message : err);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('ZAI esgotou as retentativas');
}

/** GET: lista os modelos free em uso (para exibir nas Configurações). */
export async function GET() {
  return Response.json({
    provider: 'openrouter',
    chains: {
      tutor: MODEL_CHAIN.tutor.map((id) => ({ id, label: prettyModelName(id) })),
      flashcards: MODEL_CHAIN.flashcards.map((id) => ({ id, label: prettyModelName(id) })),
    },
    providers: {
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      zaiPublic: Boolean(process.env.ZAI_API_KEY),
      zaiSdk: 'auto (só em dev/sandbox)',
    },
  });
}

/**
 * Converte LaTeX simples (que o tutor-markdown NÃO renderiza) em texto legível.
 * Modelos free costumam escapar para \[...\]/\begin{matrix} em perguntas de matemática;
 * o sanitizador garante que o aluno sempre leia a fórmula, independente do modelo.
 */
function sanitizeLatex(input: string): string {
  let out = input;

  // Matrizes: \begin{bmatrix} a & b \\ c & d \end{bmatrix} → [ a b / c d ]
  out = out.replace(
    /\\begin\{(?:b|p|v)?matrix\}([\s\S]*?)\\end\{(?:b|p|v)?matrix\}/g,
    (_m, body: string) => {
      const rows = body
        .split(/\\\\/)
        .map((r) => r.split('&').map((c) => c.trim()).filter(Boolean).join(' '))
        .filter(Boolean);
      return `[ ${rows.join(' / ')} ]`;
    },
  );

  // \frac{a}{b} → (a)/(b)  ·  \sqrt{x} → √(x)
  out = out.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
  out = out.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');

  // Símbolos comuns → unicode legível
  const symbols: Record<string, string> = {
    '\\cdot': '·', '\\times': '×', '\\div': '÷',
    '\\geq': '≥', '\\ge': '≥', '\\leq': '≤', '\\le': '≤',
    '\\neq': '≠', '\\ne': '≠', '\\pm': '±', '\\approx': '≈',
    '\\rightarrow': '→', '\\to': '→', '\\leftrightarrow': '↔',
    '\\infty': '∞', '\\sum': 'Σ',
  };
  for (const [latex, unicode] of Object.entries(symbols)) {
    out = out.split(latex).join(unicode);
  }

  // \text{...}/\mathrm{...}/\mathbf{...} → conteúdo
  out = out.replace(/\\(?:text|mathrm|mathbf|mathit)\{([^{}]*)\}/g, '$1');

  // Blocos $$...$$ e $...$ (pares) → conteúdo
  out = out.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  out = out.replace(/\$([^$\n]+)\$/g, '$1');

  // Delimitadores display/inline \[ \] \( \)
  out = out.split('\\[').join('').split('\\]').join('');
  out = out.split('\\(').join('').split('\\)').join('');

  return out;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TutorRequestBody;
    const question = (body.question ?? '').trim();
    const discipline = (body.discipline ?? 'Estudos').trim();
    const topic = (body.topic ?? '').trim();
    const material = body.material?.trim();
    const isFlashcardsMode = body.mode === 'flashcards';

    if (!question) {
      return Response.json({ error: 'Pergunta vazia.' }, { status: 400 });
    }
    if (question.length > 2000) {
      return Response.json(
        { error: 'Pergunta muito longa (máx. 2000 caracteres).' },
        { status: 400 },
      );
    }

    const history: ChatMessage[] =
      !isFlashcardsMode && Array.isArray(body.history)
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
      !isFlashcardsMode && body.hubContext && typeof body.hubContext === 'object'
        ? body.hubContext
        : undefined;

    const systemPrompt = isFlashcardsMode
      ? buildFlashcardsPrompt(discipline, topic || question)
      : buildSystemPrompt(discipline, topic, material, hub);

    const apiKey = process.env.OPENROUTER_API_KEY;
    const zaiPubKey = ZAI_PUBLIC.key;
    let answer = '';
    let usedModel = '';

    // 1º: cadeia de modelos free da OpenRouter
    if (apiKey) {
      for (const model of MODEL_CHAIN[isFlashcardsMode ? 'flashcards' : 'tutor']) {
        const t0 = Date.now();
        try {
          answer = await callOpenRouter(model, apiKey, systemPrompt, history, question);
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
        answer = await callZAIPublic(zaiPubKey, systemPrompt, history, question);
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
        answer = await callZAIRetry(systemPrompt, history, question);
        usedModel = 'Z-AI (fallback)';
      } catch (err) {
        console.error('[api/tutor] fallback ZAI falhou:', err instanceof Error ? err.message : err);
      }
    }

    // Sanitiza LaTeX que o markdown do app não renderiza (todas as respostas)
    answer = sanitizeLatex(answer);

    if (!answer) {
      return Response.json(
        {
          error:
            'O tutor IA está temporariamente indisponível (nenhum provedor respondeu). ' +
            'Dono do app: configure OPENROUTER_API_KEY (openrouter.ai, grátis) ou ZAI_API_KEY ' +
            '(api.z.ai, tier grátis do glm-4.5-flash) nas variáveis de ambiente e faça redeploy.',
        },
        { status: 502 },
      );
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

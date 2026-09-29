// A CONVERSA COM CALENDÁRIO (t151) — ajudadores PUROS que dão ao fio do
// tutor a noção de tempo que o banco já tinha e a tela escondia: separadores
// de dia ("Hoje" · "Ontem" · dd/mm), HH:MM para as mensagens restauradas e o
// recibo honesto da memória da disciplina. Nada de rede, nada de React —
// funções puras, testadas de frente (tests/test-t151-chat-calendar.ts).

/**
 * O TETO DA MEMÓRIA por disciplina — FONTE ÚNICA (t151, era 40 nas duas
 * rotas): a poda do saveTurn (api/tutor) e o take do GET (api/tutor/history)
 * leem daqui, e o recibo da tela (MemoryChip) anuncia o mesmo número. 80
 * porque a noite do debrief do simulado gera 3 conversas valiosas — o teto
 * velho apagava a semana do aluno em silêncio a cada turno novo.
 */
export const TUTOR_HISTORY_KEEP = 80;

/** 'yyyy-mm-dd' LOCAL de um instante (mesmo formato da casa em math-exam-prep). */
export function dayKeyOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * A voz do separador: 'Hoje' · 'Ontem' · 'dd/mm' (com ano quando não é o
 * corrente). Diferença de dias por MEIA-NOITE LOCAL — a mesma régua do
 * lastActivityLabel (discipline-activity), aqui em Caixa Alta de título
 * porque é cabeça de seção, não chip. Meio-dia no parse: imune a horário
 * de verão que pula a meia-noite.
 */
export function chatDayLabel(dayKey: string, now: Date = new Date()): string {
  const d = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (dias <= 0) return 'Hoje';
  if (dias === 1) return 'Ontem';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(d);
}

/**
 * ONDE o fio ganha separador: caminha os savedAt na ordem de render e marca
 * o primeiro índice de cada dia novo. Mensagem SEM savedAt (a sessão viva e
 * o welcome) pertence a Hoje — então o bloco restaurado fica honestamente
 * ENCAIXADO no meio: Hoje (welcome) → Ontem/dd/mm (restaurado) → Hoje (a
 * conversa que continua agora), cada virada de dia com sua cabeça.
 */
export function chatDayGroups(
  savedAts: (string | null | undefined)[],
  now: Date = new Date(),
): { index: number; label: string }[] {
  const todayKey = dayKeyOf(now.toISOString()) ?? '';
  const groups: { index: number; label: string }[] = [];
  let prev: string | null = null;
  let started = false;
  for (let i = 0; i < savedAts.length; i++) {
    const key = savedAts[i] ? dayKeyOf(savedAts[i]) : todayKey;
    if (!started || key !== prev) {
      groups.push({ index: i, label: chatDayLabel(key ?? todayKey, now) });
      prev = key;
      started = true;
    }
  }
  return groups;
}

/** HH:MM local de um instante salvo — o mesmo carimbo das mensagens vivas. */
export function hhmmOf(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * A BUSCA QUE OBEDECE AO IDIOMA (t153) — dobra acentos e caixa para o casamento
 * literal virar busca de gente: "logica" acha "Lógica", "proporcao" acha
 * "proporção", "INVERSA" acha "inversa". NFD separa o diacrítico da letra
 * (á → a + ́), a faixa U+0300–U+036F apaga só a marca e o lowercase iguala o
 * resto. A textura do texto no fio NÃO muda — o fold vive só na comparação
 * (a bolha continua mostrando "Lógica" com acento e maiúscula).
 */
export function searchFold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * A BUSCA QUE ACENDE O TRECHO (t154) — o fold ganhou PONTUAÇÃO e MAPA.
 *
 * searchFoldLoose: além de acentos e caixa (t153), pontuação/símbolo vira
 * espaço e espaços corridos colapsam — "não, caem" e "não caem." dobram para
 * o mesmo "nao caem", "tabela-verdade" acha "tabela verdade", e o aluno que
 * digita "proposicao logica" acha "proposição lógica?" com o ponto de
 * interrogação no fim. Letras e números nunca mudam de identidade.
 *
 * O MAPA (foldLooseWithMap) guarda, para cada caractere do texto dobrado, o
 * trecho ORIGINAL que o produziu — é o que permite o <mark> acender sobre o
 * texto de nascença (com acento, maiúscula e pontuação) em vez de um texto
 * reescrito. Caracteres que somem no fold (marca diacrítica solta de texto
 * decomposto) estendem o trecho anterior; um run de espaços fica com o
 * ÚLTIMO (o que encosta na palavra seguinte — o recorte do mark sai limpo).
 */
export type SearchSegment = { text: string; hit: boolean };

function foldLooseWithMap(s: string): { folded: string; start: number[]; end: number[] } {
  const out: string[] = [];
  const start: number[] = [];
  const end: number[] = [];
  let i = 0;
  for (const ch of Array.from(s)) {
    const len = ch.length;
    // Code point inteiro (Array.from) — emoji sobrevivem ao fatiamento.
    if (/[\p{M}]/u.test(ch)) {
      // Marca diacrítica solta (texto decomposto, ex.: "a" + U+0301): não é
      // espaço nem letra — cola no trecho anterior para "á" dobrar como um.
      if (end.length > 0) end[end.length - 1] = i + len;
    } else {
      const parts = /[\p{L}\p{N}]/u.test(ch) ? Array.from(searchFold(ch)) : [' '];
      for (const fc of parts) {
        out.push(fc);
        start.push(i);
        end.push(i + len);
      }
    }
    i += len;
  }
  // Colapso de espaços corridos: morre o espaço SEGUIDO de espaço (fica o
  // último do run); depois apara as pontas.
  const f2: string[] = [];
  const s2: number[] = [];
  const e2: number[] = [];
  for (let k = 0; k < out.length; k++) {
    if (out[k] === ' ' && k + 1 < out.length && out[k + 1] === ' ') continue;
    f2.push(out[k]);
    s2.push(start[k]);
    e2.push(end[k]);
  }
  let a = 0;
  let b = f2.length;
  while (a < b && f2[a] === ' ') a++;
  while (b > a && f2[b - 1] === ' ') b--;
  return { folded: f2.slice(a, b).join(''), start: s2.slice(a, b), end: e2.slice(a, b) };
}

/** A agulha fofa — mesmo dobro do palheiro, sem mapa. '' quando não sobra nada. */
export function searchFoldLoose(s: string): string {
  return foldLooseWithMap(s).folded;
}

/**
 * Divide o texto em pedaços [fora, dentro, fora…] para o fio desenhar o
 * <mark> só onde a agulha cai. Os `text` são SEMPRE os originais — o fold
 * mora só na comparação (a textura do fio não muda, doutrina t153). Sem
 * agulha ou sem casamento devolve o texto inteiro sem marca — o chamador
 * pode confiar: `hit: true` existe ⇔ a busca casou.
 */
export function searchMatchSegments(content: string, needle: string): SearchSegment[] {
  const q = searchFoldLoose(needle);
  if (!q || !content) return [{ text: content, hit: false }];
  const { folded, start, end } = foldLooseWithMap(content);
  const segs: SearchSegment[] = [];
  let from = 0;
  let at = folded.indexOf(q);
  while (at >= 0) {
    const hStart = start[at];
    const hEnd = end[Math.min(at + q.length - 1, end.length - 1)];
    if (hEnd > hStart && hStart >= from) {
      if (hStart > from) segs.push({ text: content.slice(from, hStart), hit: false });
      segs.push({ text: content.slice(hStart, hEnd), hit: true });
      from = hEnd;
    }
    at = folded.indexOf(q, at + Math.max(q.length, 1));
  }
  if (from < content.length) segs.push({ text: content.slice(from), hit: false });
  return segs.length ? segs : [{ text: content, hit: false }];
}

/**
 * A BUSCA QUE CAMINHA (t155) — a aritmética do navegar entre casamentos.
 * `focus` é a posição ATUAL dentro da lista de resultados (null = parado em
 * nenhum), `delta` é o passo (+1 próximo, −1 anterior). Regras:
 *  - sem resultados (total ≤ 0) → null (não há para onde ir);
 *  - parado + próximo → o PRIMEIRO (é o Enter da primeira vez);
 *  - parado + anterior → o ÚLTIMO (Shift+Enter de primeira entra pela cauda);
 *  - no fim, dá a VOLTA (o Ctrl+F do navegador: nunca trava numa borda).
 * A posição devolvida é SEMPRE um índice válido de 0..total−1 — o chamador
 * só precisa rolar até a bolha correspondente.
 */
export function searchNavStep(
  focus: number | null,
  total: number,
  delta: number,
): number | null {
  if (total <= 0) return null;
  const step = delta >= 0 ? 1 : -1;
  if (focus === null || focus < 0) return step > 0 ? 0 : total - 1;
  return (((focus + step) % total) + total) % total;
}

/**
 * O TRECHO da resposta (t154) — janela curta em volta do 1º casamento, com
 * reticências honestas quando o texto foi cortado dos dois lados. É o chip
 * que nasce sob a bolha do tutor durante a busca: mostrar ONDE a agulha
 * caiu sem reescrever o markdown da bolha (que segue intacta em cima).
 */
export function searchSnippetSegments(
  content: string,
  needle: string,
  radius = 70,
): SearchSegment[] {
  const all = searchMatchSegments(content, needle);
  const first = all.findIndex((s) => s.hit);
  if (first < 0) return [];
  let hitStart = 0;
  for (let k = 0; k < first; k++) hitStart += all[k].text.length;
  const hitEnd = hitStart + all[first].text.length;
  const a = Math.max(0, hitStart - radius);
  const b = Math.min(content.length, hitEnd + radius);
  const segs = searchMatchSegments(content.slice(a, b), needle);
  if (!segs.length) return [];
  if (a > 0) segs[0] = { text: '…' + segs[0].text, hit: false };
  if (b < content.length) {
    const last = segs[segs.length - 1];
    segs[segs.length - 1] = { text: last.text + '…', hit: last.hit };
  }
  return segs;
}

/**
 * O MAPA DO PDF (t157) — achar ANTES de folhear.
 *
 * O visualizador usa o leitor NATIVO do navegador (iframe): ele lê bem, mas
 * não deixa o Hub buscar dentro dele nem saber onde o olho está parado. O
 * arquivo, porém, é nosso — o pdf.js já extrai texto página a página (a t139
 * o usa para renderizar). Este módulo é a ponte:
 *
 *   • pdfPageText     — junta os itens de texto de UMA página (o que a busca
 *                       indexa);
 *   • searchPdfPages  — a agulha em TODAS as páginas, com a MESMA doutrina da
 *                       busca do fio (t153/t154): acentos e pontuação dobram,
 *                       o trecho exibido é o texto ORIGINAL com o casamento
 *                       aceso em âmbar;
 *   • pdfJumpSrc      — o src do iframe com #page=N, o único idioma de salto
 *                       que o leitor nativo entende;
 *   • clampPdfPage    — página honesta: inteiro ≥ 1, com teto quando existe.
 *
 * Nada aqui toca em DOM, worker ou rede — funções puras, fáceis de provar.
 */

import { searchMatchSegments, searchSnippetSegments, type SearchSegment } from './tutor-history-view';

/** Item mínimo do getTextContent do pdf.js — só o que a indexação precisa. */
export interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
}

/**
 * A CURA DO TOUNICODE QUEBRADO (t157, evidência REAL do acervo).
 *
 * PDFs do acervo (ex.: Lista de Lógica) carregam um mapa ToUnicode errado:
 * o GLIFO diz "proposições", mas o texto extraído vem "proposiÁıes" — cada
 * acentado sai trocado por um vizinho da tabela cp1252. O leitor NATIVO
 * desenha o glifo certo; a BUSCA, que lê o texto, tropeçaria nele.
 *
 * A cura é APLICADA POR PÁGINA e só quando a página grita "estou quebrada":
 * os MARCADORES FORTES (ı sem ponto, „ baixo, ˙ alto) não existem em texto
 * português legítimo — se aparecem, a página veio do mapa torto e a tabela
 * abaixo entra. Página com acentuação CORRETA não tem marcadores e NÃO é
 * tocada (um "ÁREA" bem extraído nunca vira "çREA").
 *
 * Tabela derivada do acervo real (Lista de Lógica, Matemática):
 *   proposiÁıes→proposições · sentenÁas→sentenças · s„o→são · Maranh„o→Maranhão
 *   Fortaleza È→é · lÛgico→lógico · escritÛrio→escritório · L”GICA→LÓGICA
 *   MATEM¡TICA→MATEMÁTICA · Cl·udio→Cláudio · t·xi→táxi · ¿ COMPUTAÇÃO→á
 *   ParaÌba→Paraíba · CÌntia→Cíntia · RenÍ→Renê · trÍs→três · n˙mero→número
 *   p˙blico→público · EDUCA«√O→EDUCAÇÃO (o √ fica: também é raiz quadrada)
 */
const PDF_MOJIBAKE: Record<string, string> = {
  'Á': 'ç', // proposiÁıes → proposições
  '«': 'ç', // EDUCA«√O → EDUCAÇÃO
  '¡': 'á', // MATEM¡TICA → MATEMÁTICA
  '·': 'á', // Cl·udio → Cláudio
  '¿': 'á', // APLICADA ¿ COMPUTAÇÃO → á
  '„': 'ã', // s„o → são
  'È': 'é', // Fortaleza È → é
  'Í': 'ê', // RenÍ → Renê
  'Ì': 'í', // CÌntia → Cíntia
  'Õ': 'í', // PARAÕBA → PARAÍBA
  'Û': 'ó', // lÛgico → lógico
  '”': 'Ó', // L”GICA → LÓGICA
  '˙': 'ú', // n˙mero → número
  'ı': 'õ', // proposiÁıes → proposições
};

/** Marcadores de página quebrada — em texto pt-BR legítimo, jamais aparecem. */
const PDF_MOJIBAKE_MARKERS = ['ı', '„', '˙'];

/**
 * Cura o texto de UMA página: só se um marcador forte estiver presente. O
 * trecho exibido pela busca fica IGUAL ao que o glifo diz (o leitor nativo
 * mostra "lógico"; agora o texto extraído também diz).
 */
export function repairPdfMojibake(text: string): string {
  if (!text) return text;
  let broken = false;
  for (const m of PDF_MOJIBAKE_MARKERS) {
    if (text.includes(m)) {
      broken = true;
      break;
    }
  }
  if (!broken) return text;
  let out = '';
  for (const ch of text) out += PDF_MOJIBAKE[ch] ?? ch;
  return out;
}

/**
 * Junta os itens de texto de UMA página numa linha só — JÁ CURADO. O hasEOL
 * vira espaço (fim de linha separa palavras — nunca cola "matriz" com
 * "inversa"), os espaços corridos colapsam e o ToUnicode torto do arquivo
 * é concertado (repairPdfMojibake): a busca e os trechos leem o que o GLIFO
 * diz, não o que o mapa quebrado mandou. Palavras cisradas com hífen no fim
 * da linha continuam cisradas — caso raro, aceito de olhos abertos.
 */
export function pdfPageText(items: PdfTextItem[]): string {
  if (!items || !items.length) return '';
  let out = '';
  for (const item of items) {
    out += item.str ?? '';
    if (item.hasEOL) out += ' ';
  }
  return repairPdfMojibake(out.replace(/\s+/g, ' ').trim());
}

/**
 * Página válida: inteiro ≥ 1; com teto quando o máximo existe (e é válido).
 * Entrada NaN/Infinity/virgula solta devolve null — o chamador decide o que
 * dizer ao dono (o Hub avisa; não inventa página).
 */
export function clampPdfPage(n: number | null | undefined, max?: number): number | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < 1) return null;
  const cap = max !== undefined && Number.isFinite(max) && max >= 1 ? Math.floor(max) : undefined;
  return cap !== undefined ? Math.min(i, cap) : i;
}

/**
 * src do iframe para o leitor NATIVO saltar: `caminho#page=N`. Qualquer
 * fragmento anterior morre (nunca `arquivo.pdf#a#page=3`); sem página válida
 * devolve o caminho puro — o src NUNCA fica sujo.
 */
export function pdfJumpSrc(path: string, page: number | null | undefined): string {
  const base = (path || '').split('#')[0];
  if (!base) return path;
  const p = clampPdfPage(Number(page));
  return p ? `${base}#page=${p}` : base;
}

/** Um trecho achado: a página onde mora + o recorte com o casamento aceso. */
export interface PdfSearchHit {
  page: number;
  segments: SearchSegment[];
  /**
   * TODAS as ocorrências da agulha NESSA página (o cap de exibição não
   * mente no rótulo: a página pode ter 5 casamentos e mostrar 2 trechos —
   * o badge diz "· 5×" e o title explica).
   */
  count: number;
}

/** Limites honestos: 2 trechos por página e 80 no total — a lista nunca vira o PDF. */
export const PDF_SEARCH_PER_PAGE = 2;
export const PDF_SEARCH_TOTAL = 80;
/** Raio da janela do trecho — o mesmo da busca do fio (t154). */
export const PDF_SEARCH_RADIUS = 70;

/**
 * A agulha em TODAS as páginas. A doutrina é a MESMA da busca do fio:
 *   • comparação dobrada — "logica" acha "Lógica", "nao caem" acha "não,
 *     caem." (searchMatchSegments faz o casamento pesado);
 *   • exibição ORIGINAL — o trecho mostra o texto de nascença com acento e
 *     maiúscula, e o <mark> acende só no casamento;
 *   • janelas que não se pisam — dois casamentos colados viram UM trecho
 *     (o segundo cai fora da janela do primeiro, não há trecho duplicado).
 *
 * Devolve os hits EM ORDEM DE PÁGINA (1..N), no máximo `perPage` trechos por
 * página e `total` no geral — PDF de 47 páginas com a mesma palavra em toda
 * parte não vira uma lista infinita.
 */
export function searchPdfPages(
  texts: string[],
  needle: string,
  opts?: { perPage?: number; total?: number; radius?: number },
): PdfSearchHit[] {
  const q = (needle ?? '').trim();
  const perPage = Math.max(1, opts?.perPage ?? PDF_SEARCH_PER_PAGE);
  const total = Math.max(1, opts?.total ?? PDF_SEARCH_TOTAL);
  const radius = Math.max(10, opts?.radius ?? PDF_SEARCH_RADIUS);
  if (!q || !texts.length) return [];

  const hits: PdfSearchHit[] = [];
  for (let i = 0; i < texts.length && hits.length < total; i++) {
    const text = texts[i] ?? '';
    if (!text) continue;
    const all = searchMatchSegments(text, q);
    // Offset de CADA casamento no texto original (soma dos trechos antes dele).
    const starts: number[] = [];
    let pos = 0;
    for (const seg of all) {
      if (seg.hit) starts.push(pos);
      pos += seg.text.length;
    }
    let lastEnd = -1;
    let taken = 0;
    const count = starts.length; // TODAS as ocorrências — o cap é de EXIBIÇÃO
    for (const start of starts) {
      if (taken >= perPage || hits.length >= total) break;
      if (start <= lastEnd) continue; // já dentro da janela anterior — sem trecho repetido
      const a = Math.max(0, start - radius);
      const segs = searchSnippetSegments(text.slice(a), q, radius);
      if (!segs.length) continue;
      if (a > 0) segs[0] = { ...segs[0], text: '…' + segs[0].text };
      hits.push({ page: i + 1, segments: segs, count });
      const winLen = segs.reduce((n, s) => n + s.text.length, 0);
      lastEnd = a + winLen;
      taken++;
    }
  }
  return hits;
}

/**
 * A PERGUNTA QUE NASCE DO TRECHO (t158) — o último gesto da cadeia do mapa:
 * achar → saltar → printar → PERGUNTAR. Monta a pergunta que pré-preenche o
 * tutor (o aluno revisa e envia — o campo é dele): o contexto do material, a
 * página e o PRÓPRIO trecho (texto de nascença, com as reticências da
 * janela). O recorte tem teto de 220 caracteres — a pergunta cabe no campo e
 * a IA lê o essencial; espaços da extração não vazam para o rótulo.
 */
export function pdfSnippetQuestion(materialTitle: string, page: number, snippet: string): string {
  const t = (materialTitle || '').trim() || 'o material';
  const flat = (snippet || '').replace(/\s+/g, ' ').trim();
  const MAX = 220;
  const s = flat.length > MAX ? flat.slice(0, MAX) + '…' : flat;
  return `Estou estudando "${t}" e na página ${page} encontrei este trecho: "${s}". Me explica o que ele quer dizer?`;
}

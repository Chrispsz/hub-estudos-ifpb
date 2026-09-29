// paste-cleanup — a colagem de PDF que chega INTEIRA ao Tutor IA.
//
// A dor do dono (28/09): "se eu copio e colo como vai todo quebrado ela ainda
// pode errar na montagem" — copiar texto de PDF quebra linhas a cada coluna do
// layout (o wrap é GEOMÉTRICO, não semântico), parte palavras com hífen de
// quebra de linha e o modelo tem que REMONTAR o texto — às vezes errando a
// montagem exatamente como o dono flagrou. Esta régua detecta a colagem
// rasgada e remonta ANTES de o texto entrar no chat: linhas duras viram
// espaço, hífen de quebra é desfeito, itens de lista e parágrafos sobrevivem.
//
// CONTRATO DE SEGURANÇA (o que a régua NUNCA toca):
// - colagem normal do aluno (poucas linhas, ou linhas que terminam em
//   pontuação) — nada muda, byte a byte;
// - código (linhas terminando em { } ; — o bloco de código existe para isso;
//   mesmo colado no campo errado, o texto sai igual);
// - itens de lista ("1.", "a)", "-", "•") — o QUEBRA-LINHA entre eles é a
//   estrutura, nunca vira espaço;
// - linhas em branco — separação de parágrafo, preservada (máx. 1).
//
// Determinístico e puro: testado em tests/test-paste-cleanup-141.ts.

/** Item de lista no começo da linha: marcador OU número/letra + . ou ) .
 *  O espaço depois é obrigatório ("1. Calcule" sim; "3x + 2" não). */
const LIST_ITEM_RE = /^(?:[-•*·‣◦–]|\d{1,3}[.)]|[a-hj-zA-HJ-Z][.)])\s+\S/;

/** Código colado por engano: linhas que terminam com chaves/ponto-e-vírgula
 *  (≥2 já é programa) — a régua se cala, código é verbatim. */
function looksLikeCode(lines: string[]): boolean {
  const codeEnds = lines.filter((l) => /[{};]\s*$/.test(l)).length;
  return codeEnds >= 2 || /^\s*#include\s/m.test(raw0(lines));
}

// helper mínimo para o #include (evita duplicar o join)
function raw0(lines: string[]): string {
  return lines.join('\n');
}

/**
 * O texto colado tem perfil de PDF rasgado? (≥4 linhas não-vazias e ≥40% das
 * quebras acontecem NO MEIO da frase — a linha não termina em pontuação nem é
 * item de lista). Texto digitado à mão raramente atinge o gatilho, e quando
 * atinge, o conserto (juntar com espaço) é exatamente o que o aluno quis.
 */
export function looksFragmentedPaste(raw: string): boolean {
  if (raw.length < 80) return false;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 4) return false;
  if (looksLikeCode(lines)) return false;
  const breaks = lines.slice(0, -1);
  const midSentence = breaks.filter(
    (l) => !/[.!?:;…”"')\]]$/.test(l) && !LIST_ITEM_RE.test(l),
  ).length;
  return midSentence / breaks.length >= 0.4;
}

/**
 * Remonta o texto rasgado: junta linhas duras com espaço, desfaz o hífen de
 * quebra (matri-\nzes → matrizes; soft hyphen U+00AD também), preserva itens
 * de lista (um por linha) e linhas em branco (parágrafo, máx. 1 seguido).
 * Espaços múltiplos internos colapsam (artefato de coluna do PDF).
 */
export function normalizePdfPaste(raw: string): string {
  // U+00AD (soft hyphen) é ruído invisível do PDF — some sempre, venha de
  // onde vier (fim de linha OU grudado no começo da linha seguinte).
  const lines = raw
    .replace(/\u00AD/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  let out = '';
  let atParaStart = true; // próxima linha começa parágrafo (não junta com espaço)

  for (const line of lines) {
    const t = line.replace(/\s+/g, ' ').trim();
    if (!t) {
      if (out && !out.endsWith('\n')) {
        out += '\n\n';
        atParaStart = true;
      }
      continue;
    }
    if (LIST_ITEM_RE.test(t)) {
      // item de lista: SEMPRE linha própria (a numeração é estrutura)
      if (!atParaStart) out += '\n';
      out += t + '\n';
      atParaStart = true;
      continue;
    }
    if (atParaStart) {
      out += t;
    } else if (/[-\u00AD]$/.test(out)) {
      // hífen de quebra de linha: une SEM espaço (matri- + zes → matrizes)
      out = out.replace(/[-\u00AD]$/, '') + t;
    } else {
      out += ' ' + t;
    }
    atParaStart = false;
  }

  return out.replace(/\n{3,}/g, '\n\n').trim();
}

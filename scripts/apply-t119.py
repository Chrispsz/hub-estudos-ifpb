#!/usr/bin/env python3
"""Task 119 recovery — reconstrói o folha-revisao-sheet.tsx editado a partir
da versão de origin/main (a árvore local foi resetada pela sessão paralela e
as edições se perderam do disco; o conteúdo integral dos edits está aqui).
Aplica as substituições do Task 109→119 (modo recitação + slot da promessa +
fuso no fmtDayBR) e falha ALTO se qualquer padrão não casar exatamente 1x.
"""
import re
import subprocess
import sys

SRC = "src/components/hub/folha-revisao-sheet.tsx"
raw = subprocess.run(
    ["git", "show", f"origin/main:{SRC}"], capture_output=True, text=True, check=True
).stdout

# ---------- Edit 1: imports lucide ----------
old = "import { ArrowLeft, Printer } from 'lucide-react';"
new = "import { ArrowLeft, Eye, EyeOff, Printer } from 'lucide-react';"

# ---------- Edit 2: import MATH_SIMULADO_DATE ----------
old2 = "  MATH_EXAM_PLAN,\n  MATH_FORMULAS,\n"
new2 = "  MATH_EXAM_PLAN,\n  MATH_FORMULAS,\n  MATH_SIMULADO_DATE,\n"

# ---------- Edit 3: fmtDayBR robusto + todayKeyLocal ----------
old3 = """function fmtDayBR(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(iso));
}"""
new3 = """function fmtDayBR(iso: string): string {
  // FUSO (lição 108 no papel): date-only ('yyyy-mm-dd') é meia-noite UTC no
  // parser — no fuso do aluno (BRT, negativo) isso vira o dia ANTERIOR à
  // noite. Datas só-de-dia são ancoradas no meio-dia LOCAL; timestamps
  // completos (run.date é full ISO) formatam no fuso do navegador, correto.
  const safe = /^\\d{4}-\\d{2}-\\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
    new Date(safe),
  );
}

/** Chave do dia de HOJE no fuso do ALUNO (getters locais — a folha é
 * perguntada no navegador do aluno, nunca no servidor). Vazia até o mount:
 * mesmo contrato honesto do useNow (o servidor não sabe a hora do aluno). */
function todayKeyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}"""

# ---------- Edit 4: estado da recitação + todayKey ----------
old4 = """  const travadasCount = countTravadas(travadas);
  const travadasTexto = formatTravadas(travadas);
  const simuladoFoco = useSimuladoFoco();

  // Data de impressão só no cliente (evita mismatch de hidratação).
  const [printedAt, setPrintedAt] = React.useState('');
  React.useEffect(() => {
    setPrintedAt(
      new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
        new Date(),
      ),
    );
  }, []);"""
new4 = """  const travadasCount = countTravadas(travadas);
  const travadasTexto = formatTravadas(travadas);
  const simuladoFoco = useSimuladoFoco();

  // MODO RECITAÇÃO — o cabeçalho das fórmulas promete "recite de memória,
  // confira aqui"; o toggle cumpre a promessa: oculta a fórmula (o aluno
  // recita) e cada caixa revela no toque. Estado de TELA: no papel a folha
  // sai SEMPRE completa (imprimir caixa oculta é sair sem tinta).
  const [recite, setRecite] = React.useState(false);
  const [revealed, setRevealed] = React.useState<Record<string, boolean>>({});
  function toggleRecite() {
    setRecite((on) => {
      if (on) setRevealed({}); // desligou = próxima rodada começa do zero
      return !on;
    });
  }
  function reveal(key: string) {
    setRevealed((prev) => ({ ...prev, [key]: true }));
  }
  // O contador conta só o que é REALMENTE escondível (a caixa 'PÓS-PROVA:
  // determinantes e sistemas' não tem fórmula — nada a ocultar, sem botão):
  // o número na tela tem que bater com o número de botões (lição 105: o DOM
  // é o juiz, não a conta otimista).
  const ocultaveis = MATH_FORMULAS.filter((f) => f.math && f.math.length > 0).length;
  const ocultas = recite
    ? ocultaveis - Object.values(revealed).filter(Boolean).length
    : 0;

  // Data de impressão só no cliente (evita mismatch de hidratação).
  const [printedAt, setPrintedAt] = React.useState('');
  React.useEffect(() => {
    setPrintedAt(
      new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
        new Date(),
      ),
    );
  }, []);
  // Hoje no fuso do aluno, só no cliente (mesmo contrato do printedAt).
  const [todayKey, setTodayKey] = React.useState('');
  React.useEffect(() => {
    setTodayKey(todayKeyLocal());
  }, []);"""

# ---------- Edit 5: showSlot ----------
old5 = """  const vespera = MATH_EXAM_PLAN.find((d) => d.offset === 1);
  const matrizes = MATH_FORMULAS.filter((f) => f.grupo === 'Matrizes');
  const logica = MATH_FORMULAS.filter((f) => f.grupo === 'Lógica');"""
new5 = """  const vespera = MATH_EXAM_PLAN.find((d) => d.offset === 1);
  const matrizes = MATH_FORMULAS.filter((f) => f.grupo === 'Matrizes');
  const logica = MATH_FORMULAS.filter((f) => f.grupo === 'Lógica');

  // O SLOT DA PROMESSA: a folha mais provável é a impressa ANTES do simulado
  // — e é exatamente ela que nasce sem o bloco de foco. O slot diz que o
  // espaço existe, quando ele chega (data do simulado, da fonte) e o que o
  // aluno tem a fazer (reimprimir). some depois do dia do simulado sem run
  // (a promessa envelheceu mal) e vira o bloco real quando o run existe.
  const showSlot = !simuladoFoco && !!todayKey && todayKey <= MATH_SIMULADO_DATE;"""

# ---------- Edit 6: barra de ações com o toggle ----------
old6 = """          <p className="hidden text-[11px] text-zinc-500 sm:block">
            Impressão: A4 · margens padrão · sem cabeçalhos do navegador
          </p>
          <Button
            size="sm"
            onClick={() => window.print()}
            className="ml-auto gap-1.5 bg-zinc-900 text-white hover:bg-zinc-700"
            aria-label="Imprimir a folha de revisão"
          >
            <Printer className="size-3.5" aria-hidden /> Imprimir
          </Button>"""
new6 = """          <p className="hidden text-[11px] text-zinc-500 sm:block">
            Impressão: A4 · margens padrão · sem cabeçalhos do navegador
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggleRecite}
              aria-pressed={recite}
              title={
                recite
                  ? 'Clique nas caixas tracejadas para conferir as fórmulas'
                  : 'Oculta as fórmulas para você recitar de memória (a folha impressa sai sempre completa)'
              }
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1 active:scale-[0.97]',
                recite
                  ? 'bg-zinc-900 text-white hover:bg-zinc-700'
                  : 'border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
              )}
            >
              {recite ? (
                <Eye className="size-3.5" aria-hidden />
              ) : (
                <EyeOff className="size-3.5" aria-hidden />
              )}
              {recite ? (
                <>
                  Recitação ·{' '}
                  <span className="tabular-nums">{ocultas}</span> oculta{ocultas === 1 ? '' : 's'}
                </>
              ) : (
                'Modo recitação'
              )}
            </button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5 bg-zinc-900 text-white hover:bg-zinc-700"
              aria-label="Imprimir a folha de revisão"
            >
              <Printer className="size-3.5" aria-hidden /> Imprimir
            </Button>
          </div>"""

# ---------- Edit 7: props nos FormulaBoxes ----------
old7 = """              {matrizes.map((f, i) => (
                <FormulaBox key={f.titulo} n={i + 1} titulo={f.titulo} corpo={f.corpo} math={f.math} grupo={f.grupo} />
              ))}
              {logica.map((f, i) => (
                <FormulaBox
                  key={f.titulo}
                  n={matrizes.length + i + 1}
                  titulo={f.titulo}
                  corpo={f.corpo}
                  math={f.math}
                  grupo={f.grupo}
                />
              ))}"""
new7 = """              {matrizes.map((f, i) => (
                <FormulaBox
                  key={f.titulo}
                  n={i + 1}
                  titulo={f.titulo}
                  corpo={f.corpo}
                  math={f.math}
                  grupo={f.grupo}
                  hiddenMath={recite && !revealed[f.titulo]}
                  onReveal={() => reveal(f.titulo)}
                />
              ))}
              {logica.map((f, i) => (
                <FormulaBox
                  key={f.titulo}
                  n={matrizes.length + i + 1}
                  titulo={f.titulo}
                  corpo={f.corpo}
                  math={f.math}
                  grupo={f.grupo}
                  hiddenMath={recite && !revealed[f.titulo]}
                  onReveal={() => reveal(f.titulo)}
                />
              ))}"""

# ---------- Edit 8: slot da promessa antes do foco ----------
old8 = "            {simuladoFoco && (\n"
new8 = """            {showSlot && (
              <div className="mb-3 break-inside-avoid rounded-md border border-dashed border-zinc-300 border-l-4 border-l-zinc-400 bg-zinc-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                  Foco do simulado · chega em {fmtDayBR(MATH_SIMULADO_DATE)}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-zinc-600">
                  A promessa do plano: o bloco com mais erros do ensaio vira a revisão da
                  véspera. Depois de rodar o simulado, volte e{' '}
                  <strong className="text-zinc-800">reimprima esta folha</strong> — o resultado
                  entra neste espaço.
                </p>
              </div>
            )}
            {simuladoFoco && (
"""

# ---------- Edit 9: assinatura do FormulaBox ----------
old9 = """/** Caixa de fórmula compacta — numeração contínua, acento por grupo. */
function FormulaBox({
  n,
  titulo,
  corpo,
  math,
  grupo,
}: {
  n: number;
  titulo: string;
  corpo: string;
  math?: string[];
  grupo: string;
}) {
  const isMat = grupo === 'Matrizes';"""
new9 = """/** Caixa de fórmula compacta — numeração contínua, acento por grupo.
 * RECITAÇÃO: hiddenMath troca a fórmula por um botão tracejado de conferir
 * (o aluno recita antes). No papel a caixa sai SEMPRE completa — o botão é
 * print:hidden e a fórmula oculta é hidden print:block. */
function FormulaBox({
  n,
  titulo,
  corpo,
  math,
  grupo,
  hiddenMath = false,
  onReveal,
}: {
  n: number;
  titulo: string;
  corpo: string;
  math?: string[];
  grupo: string;
  hiddenMath?: boolean;
  onReveal?: () => void;
}) {
  const isMat = grupo === 'Matrizes';"""

# ---------- Edit 10: render da fórmula (botão + gêmea de impressão) ----------
old10 = """      {math && (
        <div className="mt-0.5 rounded bg-zinc-50 px-2 py-1 print:bg-zinc-50">
          {math.map((line, i) => (
            <TutorMarkdown
              key={i}
              content={`$$${line}$$`}
              className="text-[11px] [&_.katex-display]:my-0.5"
            />
          ))}
        </div>
      )}"""
new10 = """      {math && hiddenMath ? (
        <>
          <button
            type="button"
            onClick={onReveal}
            aria-label={`Conferir a fórmula: ${titulo}`}
            title="Recitou? toque para conferir"
            className="mt-0.5 flex w-full items-center justify-between gap-2 rounded border border-dashed border-zinc-400 bg-zinc-50 px-2 py-2 text-left transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-1 active:scale-[0.99] print:hidden"
          >
            <span className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-zinc-500">
              Recite o conteúdo — toque para conferir
            </span>
            <Eye className="size-3.5 shrink-0 text-zinc-400" aria-hidden />
          </button>
          {/* O papel precisa da tinta: na impressão a fórmula oculta volta
              (hidden print:block) — a folha sai SEMPRE completa. */}
          <div className="mt-0.5 hidden rounded bg-zinc-50 px-2 py-1 print:block print:bg-zinc-50">
            {math.map((line, i) => (
              <TutorMarkdown
                key={i}
                content={`$$${line}$$`}
                className="text-[11px] [&_.katex-display]:my-0.5"
              />
            ))}
          </div>
        </>
      ) : (
        math && (
          <div className="mt-0.5 rounded bg-zinc-50 px-2 py-1 print:bg-zinc-50">
            {math.map((line, i) => (
              <TutorMarkdown
                key={i}
                content={`$$${line}$$`}
                className="text-[11px] [&_.katex-display]:my-0.5"
              />
            ))}
          </div>
        )
      )}"""

edits = [
    ("imports lucide", old, new),
    ("import MATH_SIMULADO_DATE", old2, new2),
    ("fmtDayBR + todayKeyLocal", old3, new3),
    ("estado recitação + todayKey", old4, new4),
    ("showSlot", old5, new5),
    ("barra de ações", old6, new6),
    ("props FormulaBoxes", old7, new7),
    ("slot da promessa", old8, new8),
    ("assinatura FormulaBox", old9, new9),
    ("render fórmula", old10, new10),
]

out = raw
for name, o, n in edits:
    count = out.count(o)
    if count != 1:
        print(f"FATAL: padrão '{name}' casou {count}x (esperava 1) — nada aplicado.")
        sys.exit(1)
    out = out.replace(o, n)

with open("/tmp/folha-t119.tsx", "w") as f:
    f.write(out)
print(f"OK: {len(edits)} edits aplicados → /tmp/folha-t119.tsx ({len(out)} chars)")
print("marcadores:", all(m in out for m in ["showSlot", "ocultaveis", "MATH_SIMULADO_DATE", "Recite o conteúdo", "todayKeyLocal"]))

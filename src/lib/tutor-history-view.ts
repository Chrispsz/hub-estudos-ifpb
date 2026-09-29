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

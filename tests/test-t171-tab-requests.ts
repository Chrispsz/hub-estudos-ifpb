/**
 * Task 171 — O PEDIDO QUE NÃO VIRA ZUMBI + O AVISO HONESTO DE DESCARTE.
 *
 * Contrato (executável com `bun tests/test-t171-tab-requests.ts`):
 *  A. LIB PURA ephemeral-registry: espelho do chip pendente — mesma vida do
 *     anexo (memória), zero disco/storage/fetch, leitura defensiva.
 *  B. page.tsx: clearDeliveredRequests mata os 4 pedidos entregues
 *     (tutorReq/simuladoReq/practiceReq/methodParams) na navegação para fora
 *     da aba-alvo — e NÃO mata na entrega (handlers só setam).
 *  C. popstate usa a MESMA régua do clique (voltar do browser também mata).
 *  D. study-view: o espelho escreve a cada mudança do par e zera no cleanup.
 *  E. Estudo (mandatório ④): animação de entrada do chip (2 superfícies) +
 *     X com foco visível e voz rosa do corte (2 superfícies) + anéis de
 *     foco e indicador esmeralda na navegação principal.
 *  F. Doutrina: nada de storage/localStorage no registro; nada de fetch;
 *     os handlers de evento não chamam a limpeza (a entrega é anterior).
 */

import * as React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0;
let fail = 0;
function ok(cond: boolean, label: string) {
  if (cond) {
    pass += 1;
    console.log(`  [OK] ${label}`);
  } else {
    fail += 1;
    console.log(`  [FAIL] ${label}`);
  }
}

const HERE = (import.meta as { dir?: string }).dir ?? new URL('.', import.meta.url).pathname;
const ROOT = join(HERE, '..');
const src = (p: string) => readFileSync(join(ROOT, p), 'utf8');

// ---------------------------------------------------------------------------
// A. LIB PURA — execução real
// ---------------------------------------------------------------------------
console.log('A. ephemeral-registry (execução real)');
const reg = (await import(join(ROOT, 'src/lib/ephemeral-registry.ts')).then(
  (m) => m,
)) as typeof import('../src/lib/ephemeral-registry');

// estado inicial: nada pendente (o anexo nunca nasce sozinho)
const initial = reg.readEphemeralChatState();
ok(initial.pendingImage === false && initial.pendingLabel === null, 'estado inicial: sem anexo pendente');

// espelho do chip vivo
reg.setEphemeralChatState({ pendingImage: true, pendingLabel: 'página 2 · Noções de Lógica' });
let s = reg.readEphemeralChatState();
ok(s.pendingImage === true && s.pendingLabel === 'página 2 · Noções de Lógica', 'espelho reflete o chip vivo com procedência');

// label null → rótulo some, anexo continua (paridade com o chip 'print anexado')
reg.setEphemeralChatState({ pendingLabel: null });
s = reg.readEphemeralChatState();
ok(s.pendingImage === true && s.pendingLabel === null, 'label null: anexo vivo sem procedência');

// cleanup do unmount (a forma exata que o study-view chama)
reg.setEphemeralChatState({ pendingImage: false, pendingLabel: null });
s = reg.readEphemeralChatState();
ok(s.pendingImage === false && s.pendingLabel === null, 'cleanup: espelho zerado como no unmount');

// leitura é CÓPIA (mutar a cópia não corrompe a fonte)
s.pendingImage = true;
ok(reg.readEphemeralChatState().pendingImage === false, 'leitura defensiva: a cópia não é a fonte');

// patch parcial não zera o que não veio
reg.setEphemeralChatState({ pendingImage: true, pendingLabel: 'print colado' });
reg.setEphemeralChatState({ pendingLabel: null });
s = reg.readEphemeralChatState();
ok(s.pendingImage === true, 'patch parcial preserva os outros campos');

// ---------------------------------------------------------------------------
// B. page.tsx — a raiz mata os pedidos entregues
// ---------------------------------------------------------------------------
console.log('B. page.tsx — clearDeliveredRequests (zumbi morto na raiz)');
const pageSrc = src('src/app/page.tsx');

ok(pageSrc.includes('clearDeliveredRequests'), 'a função de limpeza existe');
ok(
  pageSrc.includes("if (target !== 'study')") && pageSrc.includes('setTutorReq(undefined)'),
  'sair do Estudar mata o tutorReq (o zumbi do print/chat)',
);
ok(
  pageSrc.includes("if (target !== 'practice')") &&
    pageSrc.includes('setSimuladoReq(undefined)') &&
    pageSrc.includes('setPracticeReq(undefined)'),
  'sair do Praticar mata simuladoReq E practiceReq (diálogo e filtros não reabrem)',
);
ok(
  pageSrc.includes("if (target !== 'method')") && pageSrc.includes('setMethodParams({})'),
  'sair do Método mata methodParams (pré-config não ressuscita)',
);
ok(
  pageSrc.includes('clearDeliveredRequests(k);') && pageSrc.includes('setActiveState(k);'),
  'setActive (clique da navegação) chama a limpeza ANTES de trocar a aba',
);

// a entrega NÃO é afetada: os handlers só setam req + aba
const tutorHandler = pageSrc.slice(
  pageSrc.indexOf('function onOpenTutor'),
  pageSrc.indexOf('window.addEventListener(OPEN_TUTOR_EVENT'),
);
ok(
  !tutorHandler.includes('clearDeliveredRequests') &&
    tutorHandler.includes('setTutorReq({ detail, nonce: tutorNonce.current })') &&
    tutorHandler.includes("setActiveState('study')"),
  'entrega intacta: onOpenTutor seta o pedido e NÃO limpa nada',
);
const simuladoHandler = pageSrc.slice(
  pageSrc.indexOf('function onOpenSimulado'),
  pageSrc.indexOf('window.addEventListener(OPEN_SIMULADO_EVENT'),
);
ok(
  !simuladoHandler.includes('clearDeliveredRequests') &&
    simuladoHandler.includes('setSimuladoReq({ detail, nonce: simuladoNonce.current })'),
  'entrega intacta: onOpenSimulado seta o pedido (hoje é o dia dele)',
);

// popstate usa a mesma régua
ok(
  pageSrc.includes('clearDeliveredRequests(k); // voltar do browser também mata o pedido entregue'),
  'popstate (voltar/avançar) usa a MESMA régua do clique',
);

// o aviso no gesto de sair — t176 mudou o TOM (a perda virou promessa de
// volta: o rascunho inteiro — texto, código e anexo — sobrevive na sessão
// via composer-draft), mas o CONTRATO permanece: leitura do espelho no
// gesto de sair, só com anexo pendente, citando a procedência.
ok(
  pageSrc.includes('readEphemeralChatState()') &&
    pageSrc.includes("leaving === 'study' && eph.pendingImage"),
  'aviso só quando SAINDO do Estudar COM anexo pendente (nunca ruído)',
);
ok(
  pageSrc.includes('toast.info(') &&
    pageSrc.includes('O print anexado') &&
    pageSrc.includes('segue te esperando no Estudar'),
  'toast info com a promessa honesta de sobrevivência (t176: nada se perde na navegação)',
);
ok(
  pageSrc.includes('eph.pendingLabel') &&
    pageSrc.includes('só recarregar a página descarta'),
  'toast cita a procedência do print e a fronteira honesta (reload descarta)',
);
ok(
  pageSrc.includes("from '@/lib/ephemeral-registry'") &&
    pageSrc.includes("import { toast } from 'sonner'"),
  'page.tsx importa o registro efêmero e o toast',
);

// ---------------------------------------------------------------------------
// C. study-view — o espelho do chip
// ---------------------------------------------------------------------------
console.log('C. study-view — o espelho escreve a verdade do chip');
const studySrc = src('src/components/hub/study-view.tsx');
ok(
  studySrc.includes('setEphemeralChatState({ pendingImage: !!chatImage, pendingLabel: chatImageLabel })'),
  'efeito espelha o par (chatImage, chatImageLabel) a cada mudança',
);
ok(
  studySrc.includes('return () => setEphemeralChatState({ pendingImage: false, pendingLabel: null });'),
  'cleanup zera o espelho (unmount = morte do anexo)',
);
ok(
  studySrc.includes("}, [chatImage, chatImageLabel]);"),
  'efeito depende do PAR (uma linha só de verdade)',
);

// ---------------------------------------------------------------------------
// D. Doutrina efêmera — zero disco, zero rede
// ---------------------------------------------------------------------------
console.log('D. doutrina (t163 estendida: nada no disco, nada na rede)');
const regSrc = src('src/lib/ephemeral-registry.ts');
// a palavra pode aparecer no docstring ("PROIBIDO pela doutrina") — o que a
// doutrina proíbe é o USO da API: grepa chamadas, não palavras (lição 31).
const regNoComments = regSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(!/localStorage\s*[.[]/.test(regNoComments), 'registro não chama localStorage');
ok(!regNoComments.includes('sessionStorage'), 'registro não toca sessionStorage');
ok(!regSrc.includes('fetch'), 'registro não faz fetch');
ok(!pageSrc.includes("writeLocalStorage('hub:tutor"), 'nenhuma chave nova de storage na raiz');
ok(!studySrc.includes("setEphemeralChatState") || !studySrc.includes('localStorage.setItem('), 'espelho não escreve storage');

// ---------------------------------------------------------------------------
// E. Estilo (mandatório ④) — detalhes nas 4 superfícies
// ---------------------------------------------------------------------------
console.log('E. estilo — chips animados, X falável, navegação focável');
const panelSrc = src('src/components/hub/tutor-quick-panel.tsx');
const navSrc = src('src/components/hub/sidebar-nav.tsx');

// animação de entrada do chip nas DUAS superfícies (paridade)
ok(
  studySrc.includes('animate-in fade-in slide-in-from-bottom-1 duration-200') &&
    panelSrc.includes('animate-in fade-in slide-in-from-bottom-1 duration-200'),
  'chip nasce com entrada suave no chat E no painel',
);
// X com foco visível + voz rosa do corte nas DUAS superfícies
const xStyle = 'hover:bg-rose-500/10 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60';
ok(
  studySrc.includes(xStyle) && panelSrc.includes(xStyle),
  'X do chip: foco visível esmeralda + hover rosa (o corte é um corte) nas 2 superfícies',
);
// navegação principal focável
ok(
  navSrc.split('focus-visible:ring-emerald-500/60').length - 1 >= 2,
  'itens da navegação + "Mais" com anel de foco esmeralda',
);
ok(
  navSrc.includes('before:absolute before:left-0') &&
    navSrc.includes('before:bg-emerald-500') &&
    navSrc.includes('aria-current'),
  'item ativo ganha o indicador esmeralda da casa (aria-current mantido)',
);

// ---------------------------------------------------------------------------
// F. Anexo rótulo — labelOverride/paridade t170 intocados
// ---------------------------------------------------------------------------
console.log('F. regressões pontuais (t163/t169/t170 intocados)');
ok(
  studySrc.includes("setChatImageLabel(tutorReq.detail.imageLabel ?? 'print do material')"),
  't169: rótulo do openTutor chega ao chip (entrega intacta pela limpeza)',
);
ok(
  studySrc.includes("data-testid=\"chat-image-label\"") || studySrc.includes("'chat-image-label'") || studySrc.includes('chat-image-label'),
  't170: legenda da bolha enviada preservada',
);
ok(
  panelSrc.includes('panel-image-label') || studySrc.includes('panel-image-label') || src('src/components/hub/pdf-viewer-dialog.tsx').includes('panel-image-label'),
  't170: testid da pane preservado',
);

console.log(`\n${pass} checks OK · ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

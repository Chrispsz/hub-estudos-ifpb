/**
 * Task 176 — O RASCUNHO QUE SOBREVIVE.
 *
 * A dor (fila P2): o rascunho do composer morria na navegação — navegar do
 * Estudar desmonta o StudyView (só a aba ativa renderiza) e o texto digitado
 * (às vezes uma pergunta longa da véspera) sumia; no painel dividido, fechar
 * o diálogo do PDF matava o que estava digitado (o FIO sobrevivia desde a
 * t144, o composer não). O anexo pendente de print — o gesto CARO — morria
 * junto, com o toast da t171 avisando a perda.
 *
 * Contrato (`bun tests/test-t176-composer-draft.ts`):
 *  A. LIB PURA (execução real): composer-draft guarda/loads/limpa; vazio
 *     APAGA (o envio limpa sem saber); cópias defensivas dos dois lados;
 *     LRU no teto (MAX_COMPOSER_DRAFTS — o mais velho sai por trás);
 *     chave main:/panel:; anexo só (sem texto) sobrevive.
 *  B. Fiação do chat principal (study-view): lazy init por disciplina,
 *     espelho do composer (save effect que CALA na troca), restore que
 *     troca o rascunho junto com a disciplina, pill de restauração com
 *     descarte, anexo renascendo do rascunho, textarea re-medido na
 *     abertura (chatOpen nos deps do auto-grow).
 *  C. Fiação do painel (tutor-quick-panel): paridade — lazy init pela
 *     MESMA chave do fio (threadKey), espelho do composer, pill.
 *  D. A confissão da misericórdia (page.tsx): o toast da t171 vira
 *     toast.info de sobrevivência (nada se perde na navegação; recarregar
 *     descarta) — o espelho efêmero segue lido no gesto de sair.
 *  E. A pill da busca (t165 nota paga): o follow pill cala durante a busca
 *     do chat (o leitor está escaneando, não seguindo).
 *  F. Doutrina: lib pura sem DOM/storage/fetch — memória de sessão, a
 *     mesma fronteira do thread-cache (t144).
 */

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

// ---------------------------------------------------------------- A. LIB PURA
console.log('A. composer-draft (execução real)');
const lib = (await import(join(ROOT, 'src/lib/composer-draft.ts')).then(
  (m) => m as typeof import('../src/lib/composer-draft'),
)) as typeof import('../src/lib/composer-draft');
lib.clearAllComposerDrafts();

const kMain = lib.composerDraftKey('main', 'mat');
const kPanel = lib.composerDraftKey('panel', 'm:mat-01-matrizes');
ok(kMain === 'main:mat' && kPanel === 'panel:m:mat-01-matrizes', 'chave = escopo:id (main por disciplina, panel por thread de material)');

ok(lib.loadComposerDraft(kMain) === null, 'sem rascunho: load devolve null (nunca objeto vazio mentiroso)');
ok(lib.composerDraftCount() === 0, 'contador honesto em zero');

// roundtrip
lib.saveComposerDraft(kMain, { input: 'Me explica a questão 3 da lista — o que é a transposta?' });
const loaded = lib.loadComposerDraft(kMain);
ok(loaded?.input === 'Me explica a questão 3 da lista — o que é a transposta?', 'roundtrip: o texto guardado é o texto que volta');
ok(lib.composerDraftCount() === 1, 'um rascunho vivo');

// cópia defensiva (dois lados)
loaded!.input = 'CORROMPIDO';
ok(lib.loadComposerDraft(kMain)?.input !== 'CORROMPIDO', 'cópia defensiva na LEITURA: editar o objeto lido não corrompe o cache');
const draftRef = { input: 'rascunho vivo' };
lib.saveComposerDraft(kMain, draftRef);
draftRef.input = 'CORROMPIDO';
ok(lib.loadComposerDraft(kMain)?.input === 'rascunho vivo', 'cópia defensiva na ESCRITA: editar o objeto salvo não corrompe o cache');

// o gesto inteiro volta (código + anexo + procedência)
lib.saveComposerDraft(kPanel, {
  input: 'pergunta com print',
  code: 'int main() { return 0; }',
  image: 'data:image/jpeg;base64,FAKE',
  imageLabel: 'página 3 · Lista de Matrizes',
});
const whole = lib.loadComposerDraft(kPanel)!;
ok(whole.input === 'pergunta com print' && whole.code === 'int main() { return 0; }', 'o rascunho carrega texto E bloco de código');
ok(whole.image === 'data:image/jpeg;base64,FAKE' && whole.imageLabel === 'página 3 · Lista de Matrizes', 'o anexo pendente (o gesto caro) volta com a procedência t163');

// anexo só, sem texto — sobrevive (o print é gesto, não texto)
lib.saveComposerDraft('main:outro', { input: '', image: 'data:image/jpeg;base64,X', imageLabel: 'print colado' });
ok(lib.hasComposerDraft('main:outro'), 'anexo sem texto: o rascunho vive (o composer não está zerado)');

// vazio APAGA — o envio e o descarte limpam sem saber
lib.saveComposerDraft(kMain, { input: '   ' });
ok(!lib.hasComposerDraft(kMain), 'composer zerado (só espaço): a chave APAGA — o envio limpa sem saber');
lib.saveComposerDraft(kPanel, { input: '', code: '', image: undefined });
ok(!lib.hasComposerDraft(kPanel) && lib.composerDraftCount() === 1, 'vazio completo apaga; contador desce');

// LRU no teto
lib.clearAllComposerDrafts();
for (let i = 0; i < lib.MAX_COMPOSER_DRAFTS; i++) {
  lib.saveComposerDraft(`main:d${i}`, { input: `rascunho ${i}` });
}
ok(lib.composerDraftCount() === lib.MAX_COMPOSER_DRAFTS, `teto respeitado (${lib.MAX_COMPOSER_DRAFTS} rascunhos)`);
lib.saveComposerDraft('main:novo', { input: 'o mais novo' });
ok(!lib.hasComposerDraft('main:d0'), 'teto estourado: o MAIS VELHO sai por trás (d0 morreu)');
ok(lib.hasComposerDraft('main:d1') && lib.hasComposerDraft('main:novo'), 'LRU: os recentes vivem (d1 e o novo)');
lib.saveComposerDraft('main:d1', { input: 'rascunho 1 tocado de novo' });
lib.saveComposerDraft('main:mais-novo', { input: 'x' });
ok(lib.hasComposerDraft('main:d1'), 'tocar um rascunho o REJUVENESCE (salvar de novo = touch)');

// limpeza cirúrgica e total
lib.clearComposerDraft('main:d1');
ok(!lib.hasComposerDraft('main:d1'), 'clearComposerDraft apaga UMA chave (o X da pill)');
lib.clearAllComposerDrafts();
ok(lib.composerDraftCount() === 0, 'clearAllComposerDrafts zera (QA/testes)');

// ------------------------------------------------------- B. CHAT PRINCIPAL
console.log('B. chat principal (study-view)');
const study = src('src/components/hub/study-view.tsx');
ok(study.includes("composerDraftKey('main', disciplineCode)"), 'rascunho do chat é POR DISCIPLINA (main:<código>)');
ok(study.includes("loadComposerDraft(mainDraftKey)?.input ?? ''"), 'lazy init do texto: o composer nasce do rascunho');
ok(study.includes("loadComposerDraft(mainDraftKey)?.code ?? ''"), 'lazy init do bloco de código junto');
ok(study.includes('loadComposerDraft(mainDraftKey)?.image ?? null') && study.includes('loadComposerDraft(mainDraftKey)?.imageLabel ?? null'), 'anexo pendente e procedência renascem do rascunho (o gesto caro não morre na navegação)');
ok(study.includes('hasComposerDraft(mainDraftKey)'), 'a pill nasce informada (draftRestored do cache)');

// o espelho que CALA na troca de disciplina (senão o texto velho suja a chave nova)
const saveBlock = study.slice(study.indexOf('prevDiscRef = React.useRef'), study.indexOf('t160: o print que se lê de novo'));
ok(saveBlock.includes('if (prevDiscRef.current !== disciplineCode) return;'), 'save effect CALA no render da troca (o texto velho não suja a chave nova)');
ok(saveBlock.includes("saveComposerDraft(composerDraftKey('main', disciplineCode)"), 'save effect espelha o composer inteiro na chave da disciplina');
ok(saveBlock.includes('image: chatImage ?? undefined') && saveBlock.includes('imageLabel: chatImageLabel ?? undefined'), 'o espelho guarda o anexo com o mesmo ciclo de vida do texto');
// t178: o restore ganhou a overlay do pedido externo — o DEFAULT segue sendo
// o rascunho (d?.input ?? ''); o request só fala quando É a intenção mais nova.
ok(saveBlock.includes('prevDiscRef.current = disciplineCode;') && saveBlock.includes("d?.input ?? ''"), 'restore na troca: o composer acompanha a disciplina (pergunta de Mat não vaza para RHT; t178: pedido externo aplicado fala POR CIMA do rascunho)');
ok(saveBlock.includes('setChatImage(d?.image ?? null)') && saveBlock.includes('setDraftRestored(hasComposerDraft(key))'), 'restore troca anexo e estado da pill junto');

// a pill de restauração
ok(study.includes('data-testid="chat-draft-pill"'), 'pill do rascunho no chat principal (testid próprio)');
ok(study.includes('Rascunho restaurado') && study.includes('tabular-nums'), 'a pill conta os caracteres em tabular-nums (a gramática da casa)');
ok(study.includes('aria-label="Descartar o rascunho restaurado"'), 'o X da pill confessa o que faz');
ok(study.includes('setChatInput(\'\');\n                    setChatCode(\'\');\n                    setDraftRestored(false);'), 'descartar limpa texto + código + pill (o anexo segue pelo chip dele)');
ok(study.includes('draftRestored && !!(chatInput.trim() || chatCode.trim())'), 'a pill só vive com gesto de texto/código dentro (anexo sozinho é história do chip)');

// auto-grow re-medido na abertura (rascunho com Sheet fechado)
ok(study.includes('}, [chatInput, chatOpen]);'), 'auto-grow do textarea re-medir na abertura do chat (chatOpen nos deps)');

// ------------------------------------------------------------- C. PAINEL
console.log('C. painel dividido (tutor-quick-panel)');
const panel = src('src/components/hub/tutor-quick-panel.tsx');
ok(panel.includes("composerDraftKey('panel', threadCacheKey)"), 'rascunho do painel usa a MESMA chave do fio (threadKey — um por material)');
ok(panel.includes("loadComposerDraft(panelDraftKey)?.input ?? ''"), 'lazy init do texto no painel');
ok(panel.includes('loadComposerDraft(panelDraftKey)?.image ?? null'), 'anexo pendente renasce no painel (fechar o diálogo não mata mais)');
ok(panel.includes('saveComposerDraft(panelDraftKey, {') && panel.includes('imageLabel: pendingLabel ?? undefined'), 'espelho do composer do painel guarda texto + anexo + procedência');
ok(panel.includes('data-testid="panel-draft-pill"'), 'pill do rascunho no painel (testid próprio)');
ok(panel.includes('draftRestored && !!input.trim()'), 'pill do painel só com texto (a mesma régua do chat)');

// ------------------------------------------------- D. A CONFISSÃO (page.tsx)
console.log('D. a confissão da misericórdia (page.tsx)');
const root = src('src/app/page.tsx');
ok(root.includes("leaving === 'study' && eph.pendingImage"), 'o gesto de sair com anexo pendente continua lido (espelho t171 intacto)');
ok(root.includes('toast.info(') && root.includes('segue te esperando no Estudar'), 'o toast vira CONFISSÃO de sobrevivência (era warning de perda)');
ok(!root.includes('foi descartado ao sair do Estudar'), 'a mentira velha morreu (não há mais "descartado ao sair")');
ok(root.includes('só recarregar a página descarta'), 'a fronteira honesta confessa: só o reload descarta');

// ------------------------------------------------- E. A PILL DA BUSCA (t165)
console.log('E. follow pill cala na busca (t165 nota)');
ok(study.includes('!chatFollowing && !chatSearchOpen &&'), 'a pill do follow não briga com a busca: cala enquanto o search está aberto');

// ------------------------------------------------------------- F. DOUTRINA
console.log('F. doutrina');
const libSrc = src('src/lib/composer-draft.ts');
ok(!/localStorage\.(get|set|remove)Item|sessionStorage\.|indexedDB/.test(libSrc), 'zero storage — memória de sessão, a mesma fronteira do thread-cache (t144)');
ok(!/fetch\(|document\.|window\./.test(libSrc), 'lib pura: sem DOM, sem rede — executável em teste');
ok(libSrc.includes('MAX_COMPOSER_DRAFTS'), 'o teto é CONSTANTE exportada (o contrato é visível)');
ok(libSrc.includes('recomeça') && libSrc.includes('memória de SESSÃO'), 'a fronteira está CONFESSADA no código (quem lê sabe o que sobrevive)');

console.log(`\n${pass} ok, ${fail} fail`);
if (fail > 0) process.exit(1);

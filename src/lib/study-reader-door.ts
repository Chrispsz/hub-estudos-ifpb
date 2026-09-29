// study-reader-door — A PORTA DO LEITOR NA ABA ESTUDAR (t180).
//
// O achado da rodada: a porta da S3 (t179) selecionava o material no
// Pomodoro mas NADA abria — "Abrir a S3" prometia abertura e entregava
// seleção. Pior: a aba Estudar NÃO tinha gesto nenhum para ler o material
// selecionado (o leitor só existia na Biblioteca/disciplinas). O "Material:
// {título}" sob o cronômetro era texto morto.
//
// Este módulo guarda o QUE É PURA (visibilidade da porta, rótulo, guarda do
// auto-abrir) — sem DOM, storage nem fetch, executáveis em teste. O render
// (PdfViewerDialog) e a memória de retomada (recallPdfPage, storage) ficam
// no componente: a lib recebe números prontos e decide.

import type { Material } from '@/data/course-data';

/**
 * A porta existe? SÓ para material com PDF real — o leitor do Hub é o
 * pdf-viewer-dialog (o mesmo da Biblioteca, com o print instantâneo da
 * t175 dentro). Web page não tem leitor próprio (abre em nova aba — outra
 * porta, outro gesto); vídeo/resumo seguem com seus diálogos próprios.
 * A casa não inventa porta: sem pdfPath, a linha sob o cronômetro segue
 * sendo texto honesto.
 */
export function readerDoorVisible(material: Material | null | undefined): boolean {
  return Boolean(material?.pdfPath && material.type !== 'web_page');
}

/**
 * O rótulo da porta — HONESTO sobre a retomada: com página conhecida (último
 * salto despachado, t161), a porta diz "continuar da pág. N" — o aluno sabe
 * que não recomeça do zero ANTES de clicar. Sem memória, "abrir no leitor".
 * A voz é a mesma da pill de retomada da Biblioteca (t162): primeira letra
 * maiúscula, sem ponto final, o número em tabular no render.
 */
export function readerDoorLabel(resumePage: number | null | undefined): string {
  return resumePage != null && resumePage > 1
    ? `Continuar da pág. ${resumePage}`
    : 'Abrir no leitor';
}

/**
 * O title da porta — confessa o que abre e de onde vem a página. A mesma
 * fronteira da t179 no chip da S3: o Hub abre o MATERIAL, a entrega segue
 * no Classroom. Menção ao print (t175) porque o leitor que abre É o que
 * tem o print de 1 clique — o dono não precisa adivinhar onde a função foi
 * parar.
 */
export function readerDoorTitle(
  materialTitle: string,
  resumePage: number | null | undefined,
  maxPages?: number,
): string {
  const page =
    resumePage != null && resumePage > 1
      ? `continuar da pág. ${resumePage}${maxPages ? ` de ${maxPages}` : ''} (o último lugar onde você esteve)`
      : 'sem página guardada — abre na primeira';
  // A fronteira da t179 é DADO, não chute: material cuja procedência é o
  // Classroom (o próprio título confessa — "Questões da Semana 3 (Classroom,
  // 23/09)") carrega a segunda verdade no title. Material do acervo não
  // ganha a frase — não é a fronteira dele.
  const frontier = /Classroom/i.test(materialTitle)
    ? ' A entrega deste material segue no Classroom — o Hub abre o conteúdo.'
    : '';
  return `Abre "${materialTitle}" no leitor do Hub, ao lado do chat — ${page}.${frontier} O print da página aberta é de UM clique na barra do leitor (nada é salvo no seu computador)`;
}

/**
 * A GUARDA DO AUTO-ABRIR: a porta da S3 (t179) clicada agora ABRE o leitor
 * de verdade — MAS só UMA vez por clique de porta. Sem a guarda, cada volta
 * à aba Estudar reabriria o diálogo (o StudyView remonta a cada troca de
 * aba e initialMaterial persiste): diálogo que volta sozinho é popup, não
 * porta. As três condições JUNTAS:
 *   1. nonce > 0 — alguém clicou numa porta de verdade (goStudy com nonce);
 *      o nonce muda a CADA clique — o mesmo clique não reabre, um NOVO sim;
 *   2. há material válido na disciplina;
 *   3. o material tem PDF (readerDoorVisible).
 * Chat NÃO entra na guarda de propósito: o contrato da t179 (chat fechado)
 * é do CHAMADOR — esta lib decide só do leitor.
 */
export function shouldAutoOpenReader(
  nonce: number | null | undefined,
  hasMaterial: boolean,
  hasPdf: boolean,
): boolean {
  return Boolean(nonce && nonce > 0 && hasMaterial && hasPdf);
}

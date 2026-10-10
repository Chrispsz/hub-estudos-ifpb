// study-material-doors — AS PORTAS DO MATERIAL NA ABA ESTUDAR (t185).
//
// O achado da rodada: a porta do leitor (t180) devolveu o GESTO ao material
// com PDF — mas o inventário real do acervo (python sobre course-data) tem
// 13 web_pages + 2 vídeos + 2 exemplos SEM pdfPath, e para eles a linha
// "Material: {título}" sob o cronômetro seguiu sendo TEXTO MORTO. Pior: o
// resumo IA — que TODO material tem (50/50 summaryFile com arquivo real) e
// que carrega o "Print do resumo" da t146 dentro — também não tinha porta
// nenhuma no Estudar: para printar o resumo do material que está no
// Pomodoro, o dono precisava voltar à Biblioteca.
//
// Os DIÁLOGOS já existem e são os mesmos da Biblioteca: VideoPlayerDialog
// (YouTube/Drive/Vimeo embutido + fallback honesto quando o link não pode
// virar iframe) e MaterialSummaryDialog (resumo IA + captura do resumo
// inteiro para o tutor). A casa não inventa porta nova — esta lib decide
// QUEM tem porta e O QUE ela confessa; o render fica no componente.
//
// As três portas novas, com a fronteira confessada no title:
//   - resumo (Sparkles): todo material com summaryFile — o print do resumo
//     inteiro mora dentro (a fila P2 "print só para PDF" perde este dente);
//   - vídeo (PlayCircle): material.type 'video' COM externalUrl — o title
//     confessa se o link pode ser embutido (a verdade do parseVideoUrl
//     chega pronta da fiação, a lib não duplica parse de URL);
//   - página (ArrowUpRight): material.type 'web_page' COM externalUrl —
//     âncora real (target _blank), o gesto que a doutrina da t180 já
//     nomeava ("abre em nova aba — outra porta, outro gesto").
//
// A porta do LEITOR (PDF) NÃO é re-decidida aqui: ela é da lib irmã
// study-reader-door (t180), com rótulo de retomada e guarda de auto-abrir
// próprios — o componente concatena as duas fontes na mesma linha.
//
// Doutrina: SEM DOM/storage/fetch aqui — regra pura executável em teste
// (a fiação entra no contrato t185 greppando o componente). Labels na voz
// da casa: primeira letra maiúscula, sem ponto final.

import type { Material } from '@/data/course-data';

export type MaterialDoorKind = 'summary' | 'video' | 'web';

/** Uma porta do material sob o relógio — o componente escolhe âncora vs botão. */
export interface MaterialDoor {
  kind: MaterialDoorKind;
  /** O rótulo curto do chip ("Abrir o resumo"). */
  label: string;
  /** O title confessivo — a fronteira vai na tinta, não no achismo. */
  title: string;
  /** Aria-label nomeando o material que abre (a lição da t180). */
  ariaLabel: string;
  /** web é âncora REAL (href + target _blank) — os diálogos abrem por botão (null). */
  href: string | null;
}

/** O title da porta de vídeo confessa a verdade do EMBED (dado, não chute). */
export function videoDoorTitle(
  materialTitle: string,
  canEmbed: boolean | null | undefined,
): string {
  if (canEmbed === true) {
    return `Abre "${materialTitle}" no player do Hub, sem sair da página — o link original fica a um clique dentro do player`;
  }
  if (canEmbed === false) {
    return `Abre "${materialTitle}" no player do Hub — este link não pode ser embutido, o player abre com o botão "Abrir conteúdo em nova aba"`;
  }
  // A fiação não computou o parse (defensivo) — a confissão fica genérica e honesta.
  return `Abre "${materialTitle}" no player do Hub — quando o link não pode ser embutido, o player oferece o botão "Abrir conteúdo em nova aba"`;
}

/**
 * As portas do material selecionado, NA ORDEM da linha (primária primeiro,
 * resumo por último — o resumo é apoio, o conteúdo é o conteúdo):
 *   - PDF (com leitor): o componente já põe a porta do leitor primeiro;
 *     aqui sai só o resumo.
 *   - vídeo: [vídeo, resumo] — vídeo sem URL não ganha porta (a casa não
 *     inventa porta sem conteúdo atrás).
 *   - web_page: [página, resumo] — a página é âncora real, não diálogo.
 *   - outros sem PDF (ementa sem PDF, exemplo): [resumo].
 * Material nenhum → NENHUMA porta (a linha segue texto honesto — a mesma
 * doutrina da t180, agora para as três portas novas também).
 */
export function materialDoorsFor(
  material: Material | null | undefined,
  opts?: {
    /** Verdade do parseVideoUrl para o title do vídeo (null = não computado). */
    videoCanEmbed?: boolean | null;
  },
): MaterialDoor[] {
  if (!material) return [];
  const doors: MaterialDoor[] = [];

  if (material.type === 'video' && material.externalUrl) {
    doors.push({
      kind: 'video',
      label: 'Abrir o vídeo',
      title: videoDoorTitle(material.title, opts?.videoCanEmbed),
      ariaLabel: `Abrir ${material.title} no player do Hub`,
      href: null,
    });
  }

  if (material.type === 'web_page' && material.externalUrl) {
    doors.push({
      kind: 'web',
      label: 'Abrir a página',
      title: `Abre "${material.title}" numa nova aba do navegador — página externa não entra no leitor do Hub`,
      ariaLabel: `Abrir ${material.title} numa nova aba do navegador`,
      href: material.externalUrl,
    });
  }

  if (material.summaryFile) {
    doors.push({
      kind: 'summary',
      label: 'Abrir o resumo',
      title: `Abre o resumo IA de "${material.title}" — conceitos-chave, pontos importantes e autoavaliação; o print do resumo inteiro para o tutor mora dentro (nada é salvo no seu computador)`,
      ariaLabel: `Abrir o resumo IA de ${material.title}`,
      href: null,
    });
  }

  return doors;
}

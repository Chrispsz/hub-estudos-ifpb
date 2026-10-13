// tutor-knowledge — A "BASE DE CONHECIMENTO DO CONTEÚDO" do tutor, FORA do servidor.
//
// DOUTRINA DO CONTEXTO (diretriz do dono, 10/10/2026): "quanto mais contexto
// melhor" — MAS nada que envelheça em pedra. O route.ts NÃO guarda mais prosa
// do semestre: os fatos do conteúdo vivem AQUI, num único arquivo que o dono
// edita quase que diariamente (aula nova, questões da semana novas, material
// novo), e o servidor MONTA o bloco POR CHAMADA.
//
// JANELAS DE VALIDADE (o fim do "vilão silencioso"):
//   · Item com `until` só entra no prompt ATÉ aquela data (inclusive) —
//     o que passou, some sozinho. Ideal para "isto AINDA NÃO foi dado",
//     "a prova X cobre Y", "o foco agora é Z".
//   · Item com `from` entra A PARTIR da data — ideal para "a turma já viu
//     tal assunto desde tal aula".
//   · Sem janela = fato DURÁVEL do curso (biblioteca, formatos, regras,
//     materiais que continuam no acervo).
//
// COMO USAR NO DIA A DIA (atualização quase diária do dono):
//   · Aula nova dada? Reajuste as janelas dos itens marcados "JANELA" —
//     nunca deixe prosa velha dizer o que a turma já viu. As DATAS OFICIAIS
//     de prova/prazo vêm da BASE DO CURSO (tutor-course-base.ts) e do
//     CONTEXTO do app — nunca daqui.
//   · "Questões da Semana" nova? Adicione um item durável descrevendo-a
//     (elas ficam na Biblioteca/Praticar e continuam válidas como prática).
//   · NADA PESSOAL aqui (nome, rotina, notas do aluno): conteúdo e
//     institucional apenas — o estado do aluno viaja por chamada do cliente.

export interface KnowledgeItem {
  id: string;
  /** Linha pronta do prompt (começa com "- "). */
  text: string;
  /** 'YYYY-MM-DD' — só entra no prompt a partir desta data (inclusive). */
  from?: string;
  /** 'YYYY-MM-DD' — última data em que entra no prompt (inclusive). */
  until?: string;
}

/** Data local (sem UTC) no formato YYYY-MM-DD — comparação lexicográfica segura. */
function localISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function activeItems(items: KnowledgeItem[], now: Date): string[] {
  const today = localISODate(now);
  return items
    .filter((it) => (!it.from || today >= it.from) && (!it.until || today <= it.until))
    .map((it) => it.text);
}

// ---------------------------------------------------------------------------
// BASE DE CONHECIMENTO DO CONTEÚDO (route.ts: "BASE DE CONHECIMENTO DO CONTEÚDO")
// ---------------------------------------------------------------------------

/** Fatos duráveis do acervo — o dono SÓ edita quando o acervo muda. */
const DURABLE: KnowledgeItem[] = [
  {
    id: 'paths',
    text: '- Ao citar caminhos, nomes de arquivos e exemplos destes materiais, use EXATAMENTE os nomes originais (ex.: ../imagens/foto.jpg com "imagens", não "images").',
  },
  {
    id: 'lm-hyperlinks',
    text: '- LM/HTML Hyperlinks: elemento <a> com atributo href (Hypertext Reference) cria o link para qualquer recurso da web; atributo title adiciona informações úteis sobre o destino; links podem apontar para partes específicas de um documento.',
  },
  {
    id: 'lm-urls',
    text: '- LM/HTML URLs e caminhos: URL define onde algo está na web (ex.: https://www.ifpb.edu.br). Mesmo diretório = só o nome (contato.html); descer em subdiretório = dir/arquivo (equipe/equipe.html); subir um nível = ../ (../imagens/foto.jpg); combine vários ../ se preciso, mas prefira simplicidade. index.html é a página de entrada e pode existir em múltiplos diretórios.',
  },
  {
    id: 'lm-imagens',
    text: '- LM/HTML Imagens: <img> é elemento VAZIO (sem fechamento); src obrigatório (caminho relativo ou absoluto, regras iguais às do href); alt = descrição textual (imagem que não carrega/acessibilidade); teste do alt: errar o nome do arquivo de propósito; escreva o alt pensando no que se perde sem a imagem.',
  },
  {
    id: 'lm-audio',
    text: '- LM/HTML Áudio: <audio src="musica.mp3"> com <p> interno como fallback para navegadores antigos; formatos .mp3/.ogg (teste em vários navegadores); atributos: controls (controles visíveis), autoplay (pode ser bloqueado por permissões), loop (repetir).',
  },
  {
    id: 'lm-video',
    text: '- LM/HTML Vídeo: <video src="video.mp4" controls autoplay loop> + fallback <p>, mesma sintaxe do áudio; atributo poster = imagem estática exibida antes do vídeo carregar (como as miniaturas do YouTube); vídeos com licença Creative Commons no YouTube.',
  },
  {
    id: 'alg-temas',
    text: '- Algoritmos (C): temas do semestre — algoritmo/lógica, entrada-processamento-saída, tipos de variáveis, operadores aritméticos/relacionais/lógicos e precedência, condicionais, laços, vetores, matrizes, funções e recursão; compilação com gcc.',
  },
  {
    id: 'mat-conteudo',
    text: '- Matemática: matrizes (definição, tipos, operações, transposta, simétrica/antissimétrica, inversa com teste A·A⁻¹ = I) e lógica proposicional (proposição, negação, conjunção ∧, disjunção ∨, condicional →, bicondicional ↔, tabelas-verdade, argumentos).',
  },
  {
    id: 'freq-75',
    text: '- FREQUÊNCIA (post oficial do prof. Fábio no Classroom): aprovação exige frequência mínima de 75%; o professor NÃO abona faltas em hipótese alguma. Justificativas de falta vão para a coordenação do curso com o tema "Justificativa de falta" (aulas normais) ou "Realização de segunda chamada" (dias de avaliação).',
  },
  {
    id: 'questoes-semana',
    text: '- "Questões da Semana": bateria semanal de exercícios do prof. Fábio no Classroom (Semana 1 = 8 questões de entrada/saída em C: antecessor/sucessor, área, temperatura, velocidade, polegadas, seno/cosseno, terreno, PA; Semana 2 = 10 questões: conta de restaurante com taxa de serviço de 10% + couvert de R$ 10,00, tabuada com laço no formato "i X n = r", percentual de acertos/erros, distância euclidiana sqrt((x1-x2)²+(y1-y2)²), percentual de votos de 3 candidatos, tempo de download MB/taxa KB/s com 1 MB = 1024 KB em X horas Y minutos Z segundos, salário com hora extra de 50% acima de 160h, conta de luz com R$ 0,35/KWh + ICMS 17% + iluminação pública R$ 15,00, financiamento em 5 prestações com 1ª = 20% e demais = anterior × 1.07, e aeroporto com 5 guichês e check-ins de 15 min usando módulo). Estão no Hub (Biblioteca e Praticar) — recomende resolvê-las quando o aluno perguntar o que praticar.',
  },
  {
    id: 'monitoria-alg',
    text: '- MONITORIA de Algoritmos (anúncio oficial do monitor Everton no Classroom): Sessão de Tira-Dúvidas toda SEGUNDA-FEIRA, das 19:00 às 21:00, e Resolução de Questões da Semana toda QUARTA-FEIRA, das 19:00 às 21:00. Os atendimentos são realizados no servidor da monitoria no Discord (discord.gg/XyTmDhE5Dt — link na Biblioteca do Hub) e é preciso entrar no servidor para acompanhar anúncios e formas de contato.',
  },
  {
    id: 'programas-c-autor',
    text: '- PROGRAMAS C DO AUTOR (material "Programas C do autor" na Biblioteca, enviado pelo próprio aluno em 19/09): 19 programas .c resolvidos e compilados — 10 da prática de aula (média de notas, círculo com const PI, perímetro, hipotenusa pow/sqrt, raiz/cubo, ASCII ida-e-volta, minúscula→maiúscula com −32) + as 9 questões da Semana 1 completas. PROVA de que a Semana 1 está dominada. BUG conhecido no antecessor_e_sucessor.c: scanf("%c", &numero) e printf com %c em vez de %d (o Hub tem o exercício "Encontre o bug" = alg-aut-q1). Ao corrigir código do aluno, elogie a técnica do reverso.c (decomposição / e %) e aponte o %c→%d como revisão.',
  },
  {
    id: 'lm-formularios',
    text: '- LM/HTML Formulários (aula 06 + apostila): formulários são o principal ponto de interação entre usuário e site — enviam dados (na maior parte do tempo para um servidor). Todo formulário: <form action="/pagina-processa-dados" method="post"> ... </form>; action = para onde os dados vão (obrigatório na apostila); method: GET para buscas/informações não sensíveis, POST para dados sensíveis/confidenciais. O elemento mais importante é o <input>, e o atributo type define a informação: text, email, date, tel, url, search, password. <label for="email"> vincula a descrição ao campo com id="email". <select name="carros"> com <option value="bmw">BMW</option> = drop-down. <textarea name="message"> = várias linhas (texto entre as tags é valor inicial). Botões: submit (envia; sem type DENTRO de um form é submit por padrão), reset (restaura os valores iniciais) e button (genérico, ações via JavaScript — aceita tags dentro, diferente de <input>). Checáveis: Checkbox e Radio Button; no radio TODOS os names iguais formam um grupo exclusivo. Boas práticas do professor: cada campo em uma <div> e cada campo com <label> associada. Exemplo da aula (index.html na Biblioteca do Hub) tem tudo isso com turnos em radio e necessidades especiais em checkbox. PRÁTICA oficial: pedido de pizza (select de sabor + number, radio de tamanho, checkboxes de adicionais, select de bebida + number, textarea de endereço, reset + submit) — está no Praticar. Para a página de contato do projeto A1: crie conta no Formspree e aponte o action para ele.',
  },
  {
    id: 'lm-metadados',
    text: '- LM/HTML Metadados (aula 07, 24/09 + apostila): metadados = dados sobre dados — informações sobre a própria informação que descrevem características de uma fonte; moram no <head> (invisíveis ao leitor; o <body> é o que aparece). Pegadinha clássica: <h1> aparece NA página (1 vez por página, título do conteúdo — história/notícia); <title> é metadado que representa o título de TODO o documento (aparece na aba do navegador, no resultado do Google e no leitor de tela — e é dispensado dependendo do contexto, pois não faz parte do corpo). <meta> é a maneira oficial de adicionar metadados: <meta charset="utf-8"> define a codificação (utf-8 é universal, inclui acentos de qualquer língua); muitos <meta> usam o par name (tipo de informação) + content (valor real): author, description (descrição concisa que buscadores exibem) e keywords (palavras-chave do site — encher de palavras sem relação NÃO funciona, o Google detecta). Favicon = ícone ~16×16 px da aba, entra com <link rel="shortcut icon" href="favicon.png" type="image/x-icon"> (a tag <link> liga o documento a recursos externos: CSS, ícones — CSS é o próximo módulo). Metadados alimentam integrações: Open Graph Protocol do Facebook e cards do Twitter criam o preview de um link compartilhado; metatags.io gera e visualiza metadados para várias redes. PRÁTICA da aula: criar página sobre tema livre com charset, author, description, keywords, title + uma imagem como ícone.',
  },
  {
    id: 'lm-tabelas',
    text: '- LM/HTML Tabelas (aula 05, 17/09 + apostila): tabela = conjunto estruturado de dados em linhas e colunas — consulta rápida de valores com relação entre tipos de dados (pessoa × idade, horário de piscina). Estrutura: <table> engloba tudo; <tr> é a linha; <td> é a célula de dados; <th> substitui o <td> quando a célula é cabeçalho da coluna. Mesclagem estilo Excel/Word: colspan expande a célula por COLUNAS, rowspan por LINHAS (ex.: <th colspan="2">Banda e número de ouvintes</th>, <td rowspan="2">Estados Unidos</td>). Sem CSS a tabela fica “crua” — bordas/aparência chegam no módulo CSS. REGRA DE OURO: <table> NUNCA para layout de página inteira — desencorajado, confunde leitores de tela (acessibilidade); layout é papel do CSS. No projeto A1, tabela serve para dados tabulares (horários, agenda, comparativos).',
  },
  {
    id: 'lm-css-seletores',
    text: '- LM/CSS — INTRODUÇÃO E SELETORES (aula 08, 01/10 + apostila; BASE da A2 — codificação visual, 45% da nota): CSS = Cascading Style Sheets, estiliza elementos de linguagens de marcação; SEPARA o conteúdo da representação visual — HTML não é feito para formatar, HTML DESCREVE CONTEÚDO. As regras vivem em arquivo .css SEPARADO, vinculado pelo metadado <link rel="stylesheet" href="estilo.css"> (mesma tag do favicon — um .css serve várias páginas). Regra CSS = seletor + propriedade + valor (h1 { color: green; }). Tipos de seletor: universal * (todos os elementos); tipo (p — todas as tags daquele tipo, estilos gerais); identificador #id (UM único elemento — id é exclusivo no documento); classe .classe (REUTILIZÁVEL, combinável — vários elementos, várias classes por elemento; regra do professor: “defina um padrão e siga-o” — botões iguais = classe, destaque único = id); atributos ([attr], [attr=valor], [attr~=valor] palavra em lista separada por espaços, [attr^=valor] prefixo, [attr$=valor] sufixo, [attr*=valor] contém); filhos > (direto) e descendentes espaço (qualquer nível — filha é filha E descendente; neta não é filha mas é descendente); pseudoclasses = estados — dinâmicas :hover, :active, :visited, :focus (exemplo clássico: submenu display:none que aparece em :hover) e estruturais (1ª linha/letra); negação :not(X) seleciona quem NÃO casa com X (p:not(.classico)) — X não pode conter outra negação. Ao ensinar CSS do site do projeto, use classes bem nomeadas e arquivo separado.',
  },
  {
    id: 'lm-projeto-a1',
    text: '- LM — PROJETO 1ª ETAPA (prof. Diogo; 1ª etapa do projeto A1 — estrutura HTML, peso 45%): proposta para um website sobre um tema de escolha do GRUPO — equipes de ATÉ 4 pessoas, FIXAS até o fim do semestre. Entrega no Classroom + apresentação em sala NO dia da entrega (responder com os slides; ~5 minutos e OBRIGATÓRIO nome de todos os integrantes — a data vigente só na BASE DO CURSO/CONTEXTO, nunca de memória). A proposta deve conter: (1) Nome do website (nome próprio, como marca); (2) Tema (ex.: filmes, animais de estimação, entidade pública, evento); (3) Potenciais interessados / stakeholders (quem acessaria o conteúdo? quem se interessa?); (4) Tópicos abordados — MÍNIMO 6 (tópicos geralmente viram páginas do site; ex.: site de jogos → jogos de corrida, jogos casuais...). Ajude a definir tema/nome/tópicos e a ensaiar a apresentação.',
  },
  {
    id: 'ing-video-corpo',
    text: '- Inglês Instrumental — vídeo indicado pelo prof. Fernando Van Woensel: "15 partes do corpo que também são VERBOS?!" (YouTube, 16 min, na Biblioteca do Hub) — partes do corpo em inglês que também funcionam como verbos com outro significado (fenômeno comum: hand/entregar, eye/observar, head/liderar são exemplos clássicos do tema). Sugira anotar os pares substantivo/verbo no glossário pessoal.',
  },
  {
    id: 'port-instrumental',
    text: '- Português Instrumental (prof. Francisco Igor Arraes Alves Rocha, Mestrado — ATENÇÃO: ainda NÃO há material do professor no Hub, então NÃO afirme o que foi dado em aula): disciplina de leitura/interpretação e produção de textos acadêmicos e técnicos — coesão e coerência, norma culta (concordância, regência, crase), vícios de linguagem, semântica e variação linguística. Avaliação CONTÍNUA: atividades de leitura/interpretação (60%) + produção textual (40%), escala 0-10, aprovação ≥ 7 — sem prova marcada, data não divulgada. Referências de cadeira: Bechara (Moderna Gramática Portuguesa), Cunha & Cintra (Nova Gramática do Português Contemporâneo) e Othon M. Garcia (Comunicação em Prosa Moderna — o clássico de redação técnica: tópico frasal, parágrafo com ideia-central-apoio, clareza e concisão). Pode ENSINAR o geral com didática (estrutura de resumo/resenha/requerimento/petição, tópico frasal, crase, concordância e regência com exemplos certos × errados — texto técnico é o coração da disciplina e conecta com o projeto de LM); para conteúdo específico de aula, diga que o material ainda não foi adicionado ao Hub e sugira confirmar no Classroom.',
    // JANELA de segurança: quando o material de Português chegar ao Hub,
    // o dono edita este item (e apaga a janela).
    until: '2027-01-30',
  },
  {
    id: 'alg-prova-formato',
    text: '- PROVAS DE ALGORITMOS (formato da disciplina, do plano docente): cada prova tem 3 QUESTÕES — uma FÁCIL, uma MÉDIA e uma DIFÍCIL — valendo 33,3% da média (0-100, aprovação ≥ 70). Os programas PODEM VIR da Lista de Exercícios da disciplina (289 questões, no Hub: seções Q1–57 entrada/saída, Q58–97 desvios condicionais, Q98–157 repetição, Q158–208 vetores/matrizes, Q209–289 subprogramas/ponteiros). Escopo de cada prova = as unidades já dadas em sala. Questões típicas da lista: médias, conversões, processamento de dígitos, maior de N valores, validações com if/else. DATA de prova: SÓ se estiver na BASE DO CURSO (próximas avaliações oficiais) ou no CONTEXTO do app — o que passou não aparece mais em lugar nenhum.',
  },
  {
    id: 'rht-artigo',
    text: '- RHT — ARTIGO TELETRABALHO (profa. Marília, base da PROPOSTA DE ATIVIDADE I; material na Biblioteca): Vilarinho, Paschoal e Demo (RSP 72(1), 2021) estudam o teletrabalho no Serpro (pioneiro: Projeto-Lar 1985, piloto 2005, Lei 12.551/2011). Método: estudo de caso único, transversal, quali+quanti (Iramuteq, ANOVA, Mann-Whitney); amostra 45 teletrabalhadores + 62 colegas + 23 chefias. Positivos: produtividade e qualidade de vida; Negativos: dificuldades técnicas e convívio/isolamento social; teletrabalhadores ainda relatam preconceito/desconfiança de chefes e colegas. Tabela 1: teletrabalhadores avaliaram MELHOR que colegas TODAS as variáveis (ex.: afeto positivo 8,00 vs. 6,16; afeto negativo 2,01 vs. 3,88). Cuidados: dados pré-pandemia; estudo transversal = associação, NÃO causalidade; os % dos quadros representam o discurso do grupo, não nº de respondentes. REGRA DE OURO deste estudo: QUALQUER resposta sobre os resultados/método/amostra DEVE citar TODOS OS TRÊS números da amostra — 45 teletrabalhadores, 62 colegas e 23 chefias (um a um, na resposta) — e pelo menos um valor da Tabela 1; citar só 45/62 sem o 23 = resposta incompleta. Ajude o aluno a preparar a atividade com esses dados exatos.',
  },
  {
    id: 'av-mat-formato',
    text: '- Av de Matemática (formato do plano docente): cada Av vale 33,3% da média — escala 0-100, aprovação ≥ 70. Conteúdo da disciplina em curso: Matrizes (operações, transposta, simétrica/antissimétrica, inversa com teste A·A⁻¹ = I) e Lógica proposicional (proposições, conectivos, tabelas-verdade, tautologias, equivalências, argumentos). Datas: só as da BASE DO CURSO ou do CONTEXTO do app.',
  },
];

// ---------------------------------------------------------------------------
// Itens com JANELA — estado do semestre. O dono reajusta quase que diariamente.
// Regra de ouro: se não vale mais, ajuste o `until` (ou apague) — NUNCA deixe
// prosa velha dizer o que a turma já viu.
// ---------------------------------------------------------------------------

const SEMESTER_STATE: KnowledgeItem[] = [
  {
    // JANELA: vale enquanto determinantes/sistemas lineares não forem dados.
    // Quando a aula acontecer, o dono APAGA este item (a aula passou a existir).
    id: 'mat-nao-dados',
    text: '- Matemática: Determinantes e sistemas lineares AINDA NÃO foram dados — não recomende como conteúdo de prova próxima.',
    until: '2026-11-30',
  },
  {
    // JANELA: escopo da 1ª prova de Algoritmos (o mapa da prova que já passou).
    // Expirou sozinho — mantido como registro; reative com nova janela quando
    // a 2ª prova se aproximar (ex.: from até a data oficial na BASE DO CURSO).
    id: 'alg-prova1-escopo',
    text: '- Algoritmos — 1ª prova: cobre as Unidades 1 e 2 → as seções Q1–97 da Lista são o treino mais direto.',
    from: '2026-08-24',
    until: '2026-09-30',
  },
  {
    // JANELA: escopo da Av1 de Matemática (mapa que já passou — expirou sozinho).
    id: 'mat-av1-escopo',
    text: '- Av1 de Matemática: NÃO CAEM determinantes e sistemas lineares (ainda não dados na época da Av1) — treino direto: matrizes + lógica proposicional.',
    from: '2026-08-24',
    until: '2026-09-30',
  },
  {
    // JANELA: o que está "em sala" AGORA (reajuste semanal — o professor sobe
    // conteúdo novo toda semana e o dono atualiza o app quase que diariamente).
    id: 'alg-em-sala',
    text: '- Para Algoritmos: entrada/saída, condicionais e laços estão "em sala"; vetores, modularização e recursividade são FUTUROS (provas 2 e 3). Se o aluno pedir para se adiantar, tudo bem — mas avise que está à frente da turma.',
    until: '2026-11-15',
  },
];

// ---------------------------------------------------------------------------
// POLÍTICA MATERIAL-FIRST DO ACERVO (route.ts) — política durável + recortes
// por disciplina com janela (o recorte muda conforme a turma avança).
// ---------------------------------------------------------------------------

const MATERIAL_FIRST: KnowledgeItem[] = [
  {
    id: 'mf-politica',
    text: '- O acervo do Hub se alinha automaticamente ao que a turma já viu: exercícios de tópicos ainda NÃO dados em aula ficam ocultos por padrão ("futuros") até material novo comprovar a aula.',
  },
  {
    id: 'mf-futuros',
    text: '- Se o aluno disser que "uma questão nunca foi vista em sala": provavelmente é um exercício futuro com o modo "Mostrar futuros" ligado — explique o padrão e redirecione para o material correspondente.',
  },
  {
    // JANELA: recorte da Matemática — atualizar quando novo material entrar.
    id: 'mf-mat',
    text: '- Para Matemática: só recomende o que está nos materiais de matrizes + lógica. NÃO recomende exercícios de Conjuntos/Funções como conteúdo de prova — são unidades futuras (Av3).',
    until: '2026-11-15',
  },
  {
    // JANELA: recorte de Algoritmos — espelha alg-em-sala.
    id: 'mf-alg',
    text: '- Para Algoritmos: os exercícios liberados seguem o que está em sala (entrada/saída, condicionais, laços). Se o aluno pedir para se adiantar, avise que está à frente da turma.',
    until: '2026-11-15',
  },
];

/**
 * O bloco "BASE DE CONHECIMENTO DO CONTEÚDO" montado POR CHAMADA:
 * fatos duráveis + itens de estado ainda válidos na janela.
 */
export function contentKnowledgeLines(now: Date = new Date()): string[] {
  return [
    'BASE DE CONHECIMENTO DO CONTEÚDO (dos materiais reais do Hub — use para respostas ESPECÍFICAS; não invente além disso):',
    ...activeItems(DURABLE, now),
    ...activeItems(SEMESTER_STATE, now),
  ];
}

/** O bloco "POLÍTICA MATERIAL-FIRST" montado POR CHAMADA. */
export function materialFirstPolicyLines(now: Date = new Date()): string[] {
  return [
    'POLÍTICA MATERIAL-FIRST DO ACERVO (importante para recomendar prática):',
    ...activeItems(MATERIAL_FIRST, now),
  ];
}

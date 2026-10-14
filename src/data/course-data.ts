// Dados estruturados do curso - IFPB ADS — 1º Período • Turma 2026.2 (2ª turma ingressante do ano)
// Fonte: https://estudante.ifpb.edu.br/cursos/12/ + ementas + PDFs do usuário + PNAAT + PDFs diversos (apresentação, CAEST, Loopis, regulamentos, PNAAT Parceiros)

export type DisciplineCode =
  | 'TEC.1687' // Algoritmos
  | 'TEC.1632' // Linguagem de Marcação
  | 'TEC.0953' // RHT
  | '53647'    // Fundamentos
  | 'TEC.1984' // Matemática
  | 'ING.001'  // Inglês
  | 'PORT.001'; // Português

// Método de avaliação usado pela disciplina
export type EvaluationMethod =
  | 'aritmetica_simples'    // média aritmética das notas
  | 'ponderada_provas'     // provas com pesos diferentes
  | 'ponderada_atividades' // mistura provas + atividades com pesos
  | 'continua_formativa'  // avaliação contínua, sem prova formal
  | 'media_atividades';    // média de atividades (sem provas)

export interface GradeComponent {
  name: string;       // ex: "Prova 1", "A1", "Av1"
  weight: number;     // peso (em %, ex: 33.33 ou 45)
  scale: number;      // escala máxima (10 ou 100)
  description: string;
}

export interface Discipline {
  code: string;
  name: string;
  shortName: string;
  chTotal: number;
  chWeekly: number;
  chTheoretical?: number;
  chPractical?: number;
  professor: string;
  professorTitle?: string;
  period: string;
  category: 'exata' | 'tecnica' | 'humanas' | 'linguagens';
  color: string;
  icon: string;
  ementa: string;
  conteudoProgramatico: { unidade: string; topicos: string[] }[];
  objetivos: { geral: string; especificos: string[] };
  avaliacao: string;
  criteriosAprovacao?: string;
  // Sistema de avaliação estruturado (para a calculadora de médias)
  evaluationMethod: EvaluationMethod;
  gradeComponents: GradeComponent[]; // componentes da nota
  approvalThreshold: number;        // nota mínima para aprovação direta (ex: 70 ou 7)
  finalExamThreshold?: number;      // nota mínima p/ evitar final (ex: 40 ou 4)
  finalExamFormula?: string;        // ex: "MF = (6*MS + 4*AF)/10"
  scale: 10 | 100;                  // escala usada
  bibliografiaBasica: string[];
  bibliografiaComplementar: string[];
  dicasEstudo: string[];
  prioridade: 'alta' | 'media' | 'baixa';
  // Ordem recomendada de estudo (do PDF da ementa/professor)
  ordemEstudo?: string[];
  // Datas importantes mencionadas nos PDFs
  datasImportantes?: { data: string; descricao: string }[];
}

export interface Material {
  id: string;
  disciplineCode: string;
  title: string;
  type: 'slides' | 'lista_exercicios' | 'web_page' | 'introducao' | 'ementa' | 'video' | 'pdf' | 'image' | 'calendar' | 'exemplo';
  // PDF público (servido de /pdfs/) - opcional
  pdfPath?: string;
  // Resumo IA em /data/ai-summaries/
  summaryFile: string;
  pages?: number;
  source: 'user_upload' | 'ifpb_site' | 'pnaat' | 'external';
  externalUrl?: string;
  // PADRÃO MATERIAL-FIRST: unidades do conteudoProgramatico que ESTE material
  // comprova terem sido dadas em aula. É isto que alimenta o alinhamento de
  // Praticar/Simulado (src/lib/curriculum-state.ts). Só materiais de aula real
  // recebem a anotação — ementas, calendários e apoio NÃO contam.
  topicosCobertos?: string[];
  // GATE FINO (opcional): sub-tópicos ESPECÍFICOS dentro de uma unidade que
  // este material comprova (ex.: ['Sistemas Lineares'] quando o professor
  // finalmente der sistemas dentro de "1. Álgebra Matricial"). Libera
  // automaticamente exercícios com `requiresSubtopico` — sem editar código.
  topicosCobertosFino?: string[];
}

export interface CourseInfo {
  nome: string;
  nomeCurto: string;
  campus: string;
  instituicao: string;
  periodo: string;
  cargaHorariaTotal: number;
  periodoMinimo: number;
  totalVagas: number;
  pageUrl: string;
  semestreAtual: string;
}

export const course: CourseInfo = {
  nome: 'Tecnologia em Análise e Desenvolvimento de Sistemas',
  nomeCurto: 'ADS',
  campus: 'Cajazeiras',
  instituicao: 'Instituto Federal da Paraíba (IFPB)',
  periodo: '1º Período — Turma 2026.2',
  semestreAtual: '2026.2',
  cargaHorariaTotal: 2550,
  periodoMinimo: 6,
  totalVagas: 60,
  pageUrl: 'https://estudante.ifpb.edu.br/cursos/12/',
};

// Links importantes (centro de recursos)
export interface ImportantLink {
  title: string;
  url: string;
  description: string;
  category: 'curso' | 'institucional' | 'ferramenta' | 'pnaat' | 'material';
  icon?: string;
}

export const importantLinks: ImportantLink[] = [
  { title: 'Página do Curso (IFPB)', url: 'https://estudante.ifpb.edu.br/cursos/12/',
    description: 'Disciplinas, corpo docente, atos regulatorios e documentos do curso',
    category: 'curso', icon: 'GraduationCap' },
  { title: 'IFPB Cajazeiras', url: 'https://ifpb.edu.br/campus/cajazeiras',
    description: 'Site do campus Cajazeiras - calendario, noticias e regulamentos',
    category: 'institucional', icon: 'Building2' },
  { title: 'SUAP IFPB', url: 'https://suap.ifpb.edu.br',
    description: 'Sistema academico - notas, frequencia, boletim e matricula (use para IVS, justificativas, processos)',
    category: 'institucional', icon: 'FileText' },
  { title: 'Calendario Academico', url: 'https://ifpb.edu.br/campus/cajazeiras/ensino/calendario-academico',
    description: 'Datas oficiais do semestre (feriados, periodos letivos, avaliacoes)',
    category: 'curso', icon: 'CalendarDays' },
  { title: 'Regulamentos IFPB', url: 'https://www.ifpb.edu.br/campus/cajazeiras/ensino/regulamentos/home',
    description: 'Regulamentos gerais do campus (avaliacao, matricula, estagio)',
    category: 'institucional', icon: 'ScrollText' },
  { title: 'Google Classroom', url: 'https://classroom.google.com',
    description: 'Plataforma usada por varios professores para atividades e materiais',
    category: 'ferramenta', icon: 'BookOpen' },
  { title: 'Videoaulas de Algoritmos', url: 'https://drive.google.com/drive/folders/1QFBEca75o9E-Vd65rDdg2wktqasDzHIx',
    description: 'Pasta no Google Drive com videoaulas do Prof. Fabio Gomes',
    category: 'material', icon: 'Video' },
  { title: 'PNAAT - Plataforma FIT', url: 'https://fit-tecnologia.org.br/ava/local/customcourses/index.php',
    description: 'Programa Nacional de Aprendizado Acelerado em Tecnologia (curso EXTERNO — roda LÁ, não no hub). Trilhas de IoT e Edge AI: concluir é o 1º passo para as bolsas (Intensivo Maker R$1.800/mês; Residência em empresa até R$3.600). O hub lembra de estudar — Ter e Qui.',
    category: 'pnaat', icon: 'Cpu' },
  { title: 'Edital IVS 2026.2', url: 'https://www.ifpb.edu.br/campus/cajazeiras/noticias/2026/08/ifpb-campus-cajazeiras-lanca-edital-de-indice-de-vulnerabilidade-social-ivs',
    description: 'Edital 12/2026 - Índice de Vulnerabilidade Social. Inscrições 01/09 a 15/09 pelo SUAP. Auxílio financeiro (R$ 100-300) para estudantes em vulnerabilidade.',
    category: 'institucional', icon: 'HandCoins' },
  { title: 'CAEST - Apoio ao Estudante', url: 'https://www.ifpb.edu.br/campus/cajazeiras/assistencia-estudantil/coordenacao-de-apoio-ao-estudante',
    description: 'Coordenação de Apoio ao Estudante - IVS, PAPE, refeitório, orientações sociais. Email: caest.cz@ifpb.edu.br',
    category: 'institucional', icon: 'HeartHandshake' },
  { title: 'Loopis Jr (Empresa Júnior)', url: 'https://www.instagram.com/loopisjr/',
    description: 'Empresa júnior do curso ADS - oportunidades de estágio e vivência profissional. Professor orientador: Diogo Moreira. 27 membros.',
    category: 'curso', icon: 'Briefcase' },
  { title: 'Coordenação ADS', url: 'mailto:cads.cz@ifpb.edu.br',
    description: 'Email da coordenação do curso - use para dúvidas oficiais (não use WhatsApp)',
    category: 'institucional', icon: 'Mail' },
  { title: 'VS Code', url: 'https://code.visualstudio.com/',
    description: 'Editor recomendado para Linguagem de Marcação e Algoritmos',
    category: 'ferramenta', icon: 'Code2' },
  { title: 'W3C Validator', url: 'https://validator.w3.org/',
    description: 'Validador de HTML - use para conferir seu codigo da disciplina LM',
    category: 'ferramenta', icon: 'CheckCircle2' },
  { title: 'MDN Web Docs', url: 'https://developer.mozilla.org/pt-BR/',
    description: 'Documentacao de HTML, CSS e JavaScript (referencia em portugues)',
    category: 'ferramenta', icon: 'BookMarked' },
  { title: 'Replit', url: 'https://replit.com/',
    description: 'IDE online para praticar C sem instalar nada',
    category: 'ferramenta', icon: 'Terminal' },
];

export const disciplines: Discipline[] = [
  {
    code: 'TEC.1687',
    name: 'Algoritmos e Lógica de Programação',
    shortName: 'Algoritmos',
    chTotal: 100,
    chWeekly: 6,
    chTheoretical: 100,
    professor: 'Fabio Gomes de Andrade',
    professorTitle: 'Doutorado',
    period: '2026.2',
    category: 'exata',
    color: 'emerald',
    icon: 'Code2',
    ementa:
      'Introdução à programação. Operações de entrada e saída. Operadores aritméticos, lógicos e relacionais. Tipos de dados, variáveis e constantes. Desvios condicionais. Estruturas de repetição. Vetores e matrizes. Modularização de programas. Recursividade.',
    conteudoProgramatico: [
      { unidade: 'Unidade 1: Noções de algoritmos e programação', topicos: [
        'Definição de algoritmos', 'Algoritmos como ferramenta para resolução de problemas',
        'Notações de algoritmos', 'Introdução à linguagem C',
        'Comandos de entrada e saída de dados', 'Comando de atribuição',
        'Tipos, variáveis e constantes', 'Operadores aritméticos, lógicos e relacionais',
      ] },
      { unidade: 'Unidade 2: Desvios condicionais', topicos: ['Comando if', 'Comando switch'] },
      { unidade: 'Unidade 3: Comandos de repetição', topicos: ['Comando for', 'Comando while', 'Comando do-while'] },
      { unidade: 'Unidade 4: Vetores', topicos: ['Vetores unidimensionais', 'Vetores bidimensionais (matrizes)'] },
      { unidade: 'Unidade 5: Modularização de programas', topicos: ['Funções', 'Procedimentos', 'Recursividade'] },
    ],
    objetivos: { geral: 'Oferecer ao aluno noções sobre a construção de algoritmos e programação de computadores.',
      especificos: [
        'Apresentar a noção de algoritmos',
        'Apresentar a lógica de programação estruturada',
        'Aplicar os conceitos aprendidos e desenvolver algoritmos usando uma linguagem de programação estruturada',
      ] },
    avaliacao: '3 provas escritas (cada uma valendo 0-100 pontos). A média parcial é a média aritmética das 3 notas.',
    criteriosAprovacao: 'Aprovação por média ≥ 70. Reprovação < 40. AF para média entre 40 e 70.',
    evaluationMethod: 'aritmetica_simples',
    gradeComponents: [
      { name: 'Prova 1', weight: 33.33, scale: 100, description: 'Unidades 1 e 2 - entrada/saída, if/switch. Formato (confirmado 24/09): 3 questões — 1 fácil, 1 média, 1 difícil — programas podem vir da Lista de Exercícios (289)' },
      { name: 'Prova 2', weight: 33.33, scale: 100, description: 'Unidade 3 - repetição (for/while/do-while)' },
      { name: 'Prova 3', weight: 33.34, scale: 100, description: 'Unidades 4 e 5 - vetores, funções, recursividade' },
    ],
    approvalThreshold: 70,
    finalExamThreshold: 40,
    finalExamFormula: 'MF = (6*MS + 4*AF)/10',
    scale: 100,
    bibliografiaBasica: [
      'DAMAS, L. M. D. Linguagem C. LTC, 10ª Edição, 2006.',
      'LOPES, A.; GARCIA, G. Introdução à programação: 500 algoritmos resolvidos. Campus, 2002.',
      'SCHILDT, H. C completo e total. Makron Books, 3ª edição, 1997.',
    ],
    bibliografiaComplementar: [
      'BECKER, C. G. et al. Programação estruturada de computadores. LTC, 2008.',
      'CORMEN, T. et al. Algoritmos: teoria e prática. Campus, 2012.',
      'MANZANO, J. A. N. G. Lógica estruturada para programação de computadores. Érica, 2002.',
      'MEDINA, M; FERTIG, C. Algoritmos e programação: teoria e prática. Novatec, 2005.',
      'SOUZA, M. A. F. et al. Algoritmos e lógica de programação. Thomson Pioneira, 2005.',
    ],
    dicasEstudo: [
      'Pratique TODOS os dias - programação se aprende programando'
      + ' — suas próprias soluções da Semana 1 estão no Hub como gabarito autoral (material "Programas C do autor")',
      'Resolva as "Questões da Semana" do Classroom toda semana — elas são o treino oficial do prof. Fábio',
      'Monitoria da disciplina (monitor Everton): Tira-Dúvidas toda SEGUNDA, 19h–21h, e Resolução de Questões toda QUARTA, 19h–21h — tudo no servidor da monitoria no Discord (link na Biblioteca)',
      'Prova 1 (30/10) = 3 questões — 1 fácil, 1 média, 1 difícil — e os programas PODEM VIR DA LISTA de Exercícios (289 questões): treine as seções 1 e 2 (Q1–97 = entrada/saída + if/else) antes da prova',
      'Compile e execute cada exemplo no computador',
      'Use o depurador (debugger) para entender o fluxo do programa',
      'Quando travar, escreva o algoritmo em português antes de codar',
      'Frequência mínima de 75% para aprovação — o professor NÃO abona faltas; justificativas vão para a coordenação do curso (tema "Justificativa de falta", ou "Realização de segunda chamada" em dias de avaliação)',
    ],
    prioridade: 'alta',
    ordemEstudo: [
      '1. Leia o PDF "Introdução" da pasta de materiais',
      '2. Estude Unidade 1 (variáveis, entrada/saída, operadores)',
      '3. Resolva exercícios 1-15 da Lista de Exercícios',
      '4. Estude Unidade 2 (if/switch) - faça exercícios 16-30',
      '5. Pratique cada exemplo no VS Code ou Replit',
      '6. Revise para Prova 1 (30/10 — 3 questões: fácil/média/difícil; podem vir da Lista de Exercícios, seções Q1–97)',
      '7. Continue com Unidade 3 (repetição) após a Prova 1',
    ],
    datasImportantes: [
      { data: '30/10/2026', descricao: '1ª avaliação (até do-while)' },
      { data: '04/12/2026', descricao: '2ª avaliação (vetores e matrizes)' },
      { data: '29/01/2027', descricao: '3ª avaliação (subprogramas e recursividade)' },
      { data: '01/02/2027', descricao: 'Reposição (mediante processo no SUAP)' },
    ],
  },
  {
    code: 'TEC.1632',
    name: 'Linguagem de Marcação',
    shortName: 'Linguagens de Marcação',
    chTotal: 67,
    chWeekly: 4,
    chTheoretical: 30,
    chPractical: 37,
    professor: 'Diogo Dantas Moreira',
    professorTitle: 'Mestrado',
    period: '2026.2',
    category: 'tecnica',
    color: 'orange',
    icon: 'FileCode2',
    ementa: 'Linguagens de Marcação. Estruturação de Sites com o uso de Linguagens de Marcação. Formatação de Sites com o uso de Linguagem de Estilos. Padrões Web. Criação e validação de linguagens de marcação; Acessibilidade.',
    conteudoProgramatico: [
      { unidade: 'Introdução a Linguagens de Marcação', topicos: ['Fundamentos', 'Aplicações'] },
      { unidade: 'HTML', topicos: ['Estrutura de uma página HTML', 'Elementos básicos', 'Listas', 'Tabelas',
        'Formulários', 'Gráficos, vídeo e áudio', 'Metadados', 'Acessibilidade'] },
      { unidade: 'CSS', topicos: ['Sintaxe e estrutura', 'Seletores', 'Box Model',
        'Layouts com Grid e Flexbox', 'Media Queries', 'Transições, animações, transformações'] },
    ],
    objetivos: { geral: 'Apresentar conceitos de linguagens de marcação e de linguagens de estilo, aplicando-os na construção de sites.',
      especificos: [
        'Compreender as características de uma linguagem de marcação',
        'Estruturar sites com uso de linguagens de marcação',
        'Formatar e estilizar sites com uso de linguagem de estilo',
        'Definir um tipo ou esquema de documento descrito em linguagem de marcação',
      ] },
    avaliacao: 'Projeto prático dividido em 3 atividades: A1 (estrutura de um website, 45%), A2 (codificação visual/CSS, 45%), A3 (apresentação, 10%). MF = (45*A1 + 45*A2 + 10*A3)/100.',
    criteriosAprovacao: 'MF ≥ 70 aprovado direto. MF < 40 reprovado. 40 ≤ MF < 70 faz avaliação final.',
    evaluationMethod: 'ponderada_atividades',
    gradeComponents: [
      { name: 'A1', weight: 45, scale: 100, description: 'Estrutura de um website (HTML). 1ª etapa: proposta em slides — entrega 09/10' },
      { name: 'A2', weight: 45, scale: 100, description: 'Codificação visual (CSS)' },
      { name: 'A3', weight: 10, scale: 100, description: 'Apresentação do projeto' },
    ],
    approvalThreshold: 70,
    finalExamThreshold: 40,
    finalExamFormula: 'MF = (6*MS + 4*AF)/10',
    scale: 100,
    bibliografiaBasica: [
      'DEITEL, H. M.; DEITEL, P. J.; SADHU, P. XML. Bookman, 2003.',
      'FREEMAN, E.; FREEMAN, E. Use a cabeça! HTML com CSS e XHTML. Alta Books, 2008.',
      'LAWSON, B.; SHARP, R. Introdução ao HTML 5. Alta Books, 2011.',
    ],
    bibliografiaComplementar: [
      'MOREIRA, D. Linguagens de Marcação — apostila digital da disciplina. https://diogomoreira.gitbook.io/linguagens-de-marcacao/',
      'HOGAN, B.P. HTML 5 e CSS 3: desenvolva hoje com o padrão de amanhã. Ciência Moderna, 2012.',
      'MEYER, E. A. Smashing CSS. Bookman, 2011.',
      'PILGRIM, M. Dive Into HTML5. http://diveintohtml5.info/',
      'SILVA, M. S. CSS3. Novatec, 2011.',
      'TERUEL, E. C. HTML5: guia prático. Érica, 2014.',
    ],
    dicasEstudo: [
      'PROJETO 1ª ETAPA (entrega 09/10 + apresentação em aula): proposta do website em slides (~5 min, nome de TODOS os integrantes) com nome do site, tema, stakeholders e MÍNIMO 6 tópicos (vira página) — equipes de até 4 pessoas, FIXAS até o fim do semestre',
      'Construa um site pessoal desde a primeira semana',
      'Aula 06 (Formulários): abra o index.html de exemplo na Biblioteca, compare com os slides e faça a prática do pedido de pizza (Praticar)',
      'Aula 07 (Metadados): complete o <head> do site do projeto com charset, title, author, description, keywords e favicon — barato e conta pontos na avaliação da estrutura',
      'Use o VS Code com extensão Live Server para preview',
      'Valide seu HTML no W3C Validator',
      'Pratique Flexbox e Grid fazendo layouts reais',
      'Estude acessibilidade (atributos ARIA, semântica) - cai na A3',
    ],
    prioridade: 'alta',
    ordemEstudo: [
      '1. Estude "00 - Introdução a linguagens de marcação"',
      '2. Aprenda estrutura básica (01 - HTML, elementos, atributos)',
      '3. Pratique com o site Introdução a HTML e Tags/Elementos',
      '4. Estude Listas (02 - Listas)',
      '5. Estude Hyperlinks e URLs (03 — elemento <a>, caminhos, target, download)',
      '6. Estude Mídias (04 — img, figure/figcaption, audio e video)',
      '7. Estude Formulários (06 — form/action/method, input, select, textarea, botões e checáveis) e pratique: o formulário da pizza está no Praticar',
      '8. Comece o projeto A1 imediatamente — 1ª etapa (proposta em slides) entrega 09/10: nome, tema, stakeholders e 6+ tópicos; o capítulo Formulários da apostila cobre a página de contato (dica do Formspree)',
      '9. Depois do HTML, estude CSS (seletores, box model)',
      '10. Faça o A2 (CSS) - use Flexbox/Grid',
      '11. Prepare a apresentação A3 com antecedência',
    ],
    // POLÍTICA ANTI-ESTIMATIVA: A1/A2/A3 sem data oficial ficam em evaluationPeriods
    // como "A definir" — nada de semana estimada em lugar nenhum.
  },
  {
    code: 'TEC.1984',
    name: 'Matemática Aplicada à Computação',
    shortName: 'Matemática',
    chTotal: 67,
    chWeekly: 4,
    chTheoretical: 67,
    professor: 'Antonio Eudes Ferreira',
    professorTitle: 'Especialista',
    period: '2026.2',
    category: 'exata',
    color: 'rose',
    icon: 'Sigma',
    ementa: 'Álgebra matricial. Lógica matemática. Teoria dos conjuntos. Relações e funções.',
    conteudoProgramatico: [
      { unidade: '1. Álgebra Matricial', topicos: ['Conceituação e representação de uma matriz',
        'Operações com matrizes', 'Determinantes', 'Sistema Linear'] },
      { unidade: '2. Lógica Matemática', topicos: ['Fundamentos de Lógica', 'Proposições e Conectivos',
        'Operações lógicas sobre proposições', 'Tabelas verdade de proposições compostas',
        'Tautologias e Contradições', 'Equivalência lógica e Implicação lógica',
        'Álgebra das proposições', 'Argumentos', 'Sentenças Abertas',
        'Operações lógicas sobre sentenças abertas', 'Quantificadores'] },
      { unidade: '3. Conjuntos', topicos: ['Conceitos', 'Relações entre elementos e conjuntos',
        'Operações com conjuntos', 'Conjuntos numéricos', 'Propriedades', 'Intervalos'] },
      { unidade: '4. Funções', topicos: ['Definição e Notação', 'Gráfico',
        'Função composta, pares e ímpares, inversas', 'Funções crescentes e decrescentes',
        'Função polinomial do 1º grau', 'Função polinomial do 2º grau',
        'Função modular, exponencial, logarítmica', 'Funções trigonométricas'] },
    ],
    objetivos: { geral: 'Oferecer aos discentes noções básicas sobre Raciocínio Lógico e aplicação em problemas computacionais.',
      especificos: [
        'Usar funções matemáticas na modelagem e resolução de problemas',
        'Resolver problemas geométricos no plano e espaço',
        'Utilizar matrizes e sistemas lineares na solução de problemas',
        'Aplicar conteúdos na resolução de situações-problema',
      ] },
    avaliacao: '3 avaliações (escrita objetiva, subjetiva e trabalho). A escolha dos instrumentos fica a critério do docente conforme cronograma.',
    evaluationMethod: 'aritmetica_simples',
    gradeComponents: [
      { name: 'Av1', weight: 33.33, scale: 100, description: '1ª avaliação - Álgebra Matricial' },
      { name: 'Av2', weight: 33.33, scale: 100, description: '2ª avaliação - Lógica Matemática' },
      { name: 'Av3', weight: 33.34, scale: 100, description: '3ª avaliação - Conjuntos e Funções + trabalho' },
    ],
    approvalThreshold: 70,
    finalExamThreshold: 40,
    finalExamFormula: 'MF = (6*MS + 4*AF)/10',
    scale: 100,
    bibliografiaBasica: [
      'BOLDRINI, J. L. et al. Álgebra Linear. Harba, 3ª ed.',
      'FILHO, E. A. Iniciação à Lógica Matemática. Nobel, 2002.',
      'IEZZI, G. Fundamentos de Matemática Elementar (Vols. 1, 2 e 3). Atual, 8ª ed., 2004.',
    ],
    bibliografiaComplementar: [
      'CRUZ, A.; MOURA, J. E. A. A lógica e a construção dos argumentos. SBMAC, 2004.',
      'MACHADO, N.; ORTEGOSA, M. Lógica e Linguagem cotidiana. Autêntica, 2005.',
      'STEINBRUCH, A.; WINTERLE, P. Álgebra Linear. McGraw-Hill, 2ª ed., 1987.',
      'CORDEIRO, D. Um convite à matemática. EDUFCG, 21ª ed., 2007.',
      'LIMA, E. L. et al. A Matemática do Ensino Médio (Vols. 1, 2, 3). SBM, 2002.',
    ],
    dicasEstudo: [
      'PROVA 01/10: siga o plano do card "Foco: Prova de Matemática" — a ordem agora é FAZER as listas: Matrizes (3 blocos) → Lógica (2 partes)',
      'Monte tabelas-verdade para TODOS os exercícios de lógica',
      'Pratique as operações com matrizes sem calculadora',
      'Determinantes é o assunto VIVO (prof. Eudes): teoria com as 14 propriedades + lista de 20 questões já no acervo',
      'Resolva exercícios extras de Lógica - base para programação',
      'Use a lista de exercícios do professor Eudes como referência',
    ],
    prioridade: 'alta',
    ordemEstudo: [
      '1. FAÇA a Lista de Matrizes (35 questões) com a teoria da Aula 00 ao lado só para consultar',
      '2. Blocos da lista: Q1–16 construir/igualdade/soma · Q17–30 produtos/simetria · Q31–35 inversa',
      '3. Depois faça a Lista de Lógica (18 questões): Q1–12 valores e tabelas · Q13–18 argumentos',
      '4. Monte tabelas-verdade de TODOS os exercícios de lógica',
      '5. Faça o simulado no D-2 (29/09) e refaça os erros na véspera',
      '6. Determinantes (o assunto AGORA): teoria da aula → lista de 20 questões em rampa — Sarrus (Q1–4) → propriedades (Q7–12) → Vandermonde/Binet (Q17–20); Sistemas Lineares vem depois',
      '7. Conjuntos (Un. 3) e Funções (Un. 4): foco DEPOIS da Av1',
    ],
    // POLÍTICA ANTI-ESTIMATIVA: Av1/Av2/Av3 sem data oficial ficam em
    // evaluationPeriods como "A definir" — nada de semana estimada.
  },
  {
    code: '53647',
    name: 'Fundamentos da Computação',
    shortName: 'Fundamentos',
    chTotal: 67,
    chWeekly: 4,
    chTheoretical: 67,
    professor: 'André Lira Rolim',
    professorTitle: 'Especialista',
    period: '2026.2',
    category: 'tecnica',
    color: 'violet',
    icon: 'Cpu',
    ementa: 'Conceitos introdutórios e fundamentais de informática. História e evolução dos computadores. Lógica digital. Conversão de base. Operações aritméticas com números binários. Arquitetura e organização básica de computadores. Lixo eletrônico como ameaça ambiental e social.',
    conteudoProgramatico: [
      { unidade: 'Hardware e Software', topicos: ['Histórico e evolução dos computadores',
        'Definições de Software e Hardware', 'Arquitetura e organização de um computador',
        'Classificação de computadores', 'Periféricos de entrada e saída'] },
      { unidade: 'Representação de Dados', topicos: ['Representação de números inteiros na base binária',
        'Representação na base octal', 'Representação na base hexadecimal',
        'Operações Aritméticas com números binários'] },
      { unidade: 'Sistemas e Lógica', topicos: ['Software básico, aplicativo, apoio à decisão, especialistas',
        'Portas Lógicas (AND, OR, NOT, NAND, NOR, XOR)'] },
    ],
    objetivos: { geral: 'Apresentar os princípios básicos e introdutórios da informática.',
      especificos: [
        'Apresentar conceitos de hardware, software e peopleware',
        'Mostrar a evolução do hardware e do software',
        'Apresentar a representação digital de dados e informação',
        'Apresentar as arquiteturas de computadores',
        'Apresentar o funcionamento das portas lógicas',
      ] },
    avaliacao: '3 avaliações (Av1, Av2, Av3). MS = (Av1+Av2+Av3)/3. Aprovação por média ≥ 70. Reprovação < 40. AF para média entre 40 e 70. MF = (6*MS + 4*AF)/10. Aprovação final: MF ≥ 50.',
    criteriosAprovacao: 'MS ≥ 70 (aprovado direto) | MS < 40 (reprovado) | 40 ≤ MS < 70 (faz AF, aprova se MF ≥ 50)',
    evaluationMethod: 'aritmetica_simples',
    gradeComponents: [
      { name: 'Av1', weight: 33.33, scale: 100, description: '1ª avaliação - Histórico, Hardware/Software' },
      { name: 'Av2', weight: 33.33, scale: 100, description: '2ª avaliação - Representação de dados, operações binárias' },
      { name: 'Av3', weight: 33.34, scale: 100, description: '3ª avaliação - Sistemas e Portas Lógicas' },
    ],
    approvalThreshold: 70,
    finalExamThreshold: 40,
    finalExamFormula: 'MF = (6*MS + 4*AF)/10, aprovado se MF ≥ 50',
    scale: 100,
    bibliografiaBasica: [
      'MONTEIRO, M. A. Introdução à Organização de Computadores. LTC, 4ª ed., 2001.',
      'IDOETA, I. V.; CAPUANO, F. G. Elementos de Eletrônica Digital. Érica, 34ª ed., 2002.',
      'VELLOSO, F. C. Informática: Conceitos Básicos. Campus, 7ª ed., 2004.',
    ],
    bibliografiaComplementar: [
      'BROOKSHEAR, J. G. Ciência da Computação: uma visão abrangente. Bookman, 11ª ed., 2023.',
      'FOROUZAN, B.; MOSHARRAF, F. Fundamentos da ciência da computação. Cengage, 2011.',
      'TANENBAUM, A. S. Organização Estruturada de Computadores. LTC, 4ª ed., 2001.',
      'STALLINGS, W. Arquitetura e Organização de Computadores. Makron Books, 5ª ed., 2002.',
      'MEIRELES, F. S. Informática: Novas Aplicações. Makron Books, 2ª ed., 1994.',
    ],
    dicasEstudo: [
      'Pratique conversões de base (binário, octal, decimal, hex) até automatizar',
      'Monte um mapa das portas lógicas com suas tabelas verdade',
      'Estude a arquitetura de von Neumann com um diagrama',
      'Relacione hardware e software - ambos se comunicam',
      'Pesquise sobre lixo eletrônico - tema de prova e atual',
    ],
    prioridade: 'media',
    ordemEstudo: [
      '1. Estude histórico e evolução dos computadores',
      '2. Aprenda conceitos de hardware e software',
      '3. Pratique conversões: binário ↔ decimal ↔ octal ↔ hex',
      '4. Faça operações aritméticas com binários (soma, subtração)',
      '5. Estude portas lógicas e monte tabelas verdade',
      '6. Revise arquitetura de von Neumann',
    ],
    datasImportantes: [
      { data: 'Semana 5', descricao: 'Av1 - Histórico, Hardware/Software' },
      { data: 'Semana 10', descricao: 'Av2 - Representação de dados, operações binárias' },
      { data: 'Semana 16', descricao: 'Av3 - Sistemas e Portas Lógicas' },
    ],
  },
  {
    code: 'TEC.0953',
    name: 'Relações Humanas no Trabalho',
    shortName: 'RHT',
    chTotal: 50,
    chWeekly: 3,
    chTheoretical: 50,
    professor: 'Marília Aguiar Ribeiro do Nascimento',
    professorTitle: 'Mestrado',
    period: '2026.2',
    category: 'humanas',
    color: 'amber',
    icon: 'Users',
    ementa: 'Breve histórico das relações humanas no trabalho. RHT enquanto teoria administrativa e ideologia gerencialista. Abordagem contemporânea das relações humanas no trabalho. Ética no trabalho. Soft skills: habilidades comportamentais e interpessoais.',
    conteudoProgramatico: [
      { unidade: 'I. Introdução às RHT', topicos: ['Definição, importância e dimensões',
        'Comportamento Humano e relações interpessoais'] },
      { unidade: 'II. Trabalho humano no Brasil', topicos: ['Abordagem transdisciplinar sobre o trabalho',
        'O Trabalho nas organizações: conceito, sentido e significado', 'Dimensão psicossocial',
        'Modalidades de Trabalho Flexíveis', 'Relações Trabalhistas e Negociações',
        'A uberização do trabalho: novas formas e precarização'] },
      { unidade: 'III. Ética no trabalho', topicos: ['O que é ética e para que serve?',
        'Ética, cidadania e direitos humanos', 'Ética no ambiente de trabalho e nas relações interpessoais'] },
      { unidade: 'IV. Boas práticas no ambiente laboral', topicos: ['Comunicação interpessoal no trabalho',
        'Liderança e a relação com a comunicação', 'Equipe e conflitos no ambiente de trabalho'] },
    ],
    objetivos: { geral: 'Compreender fatores que influenciam no comportamento dos indivíduos no trabalho, favorecendo as relações interpessoais no exercício do papel laboral.',
      especificos: [
        'Conhecer a evolução das formas de trabalho e sua interferência na relação entre as pessoas',
        'Discutir como as relações interpessoais contribuem para o desempenho de grupos',
        'Debater ferramentas para situações de divergência e conflitos (emoções e interrelações)',
        'Compreender princípios éticos e morais no ambiente de trabalho',
      ] },
    avaliacao: 'Avaliação contínua e formativa. Instrumentos: estudos de casos; debates de textos, artigos, reportagens e vídeos; seminário.',
    evaluationMethod: 'continua_formativa',
    gradeComponents: [
      { name: 'Participação/Debates', weight: 30, scale: 100, description: 'Participação ativa em debates e aulas' },
      { name: 'Estudos de Caso', weight: 30, scale: 100, description: 'Análise e apresentação de estudos de caso' },
      { name: 'Seminário', weight: 40, scale: 100, description: 'Apresentação de seminário (pesquisa + ensaio)' },
    ],
    approvalThreshold: 70,
    finalExamThreshold: 40,
    scale: 100,
    bibliografiaBasica: [
      'JOHANN, S. L. Comportamento organizacional. Saraiva, 2013.',
      'MARQUES, J. C. Comportamento Organizacional. Cengage, 2016.',
      'MINICUCCI, A. Relações Humanas. Atlas, 6ª ed., 2013.',
    ],
    bibliografiaComplementar: [
      'BUENO, W. C. Comunicação empresarial. Manole, 2014.',
      'GIL, A. C. Gestão de Pessoas. Atlas, 2ª ed., 2019.',
      'LATTIMORE et al. Relações Públicas. AMGH, 3ª ed., 2012.',
      'MINICUCCI, A. Dinâmica de grupo. Atlas, 5ª ed., 2012.',
      'TOMASI, C.; MEDEIROS, J. B. Comunicação empresarial. Atlas, 5ª ed., 2019.',
    ],
    dicasEstudo: [
      'Participe ativamente dos debates em sala - contam ponto',
      'Faça resumos dos textos indicados antes das aulas',
      'Conecte os conceitos com situações reais do mercado',
      'Prepare o seminário com antecedência (pesquisa + ensaio)',
      'Estude ética - tema transversal em todas as unidades',
      'Atividade I (Classroom, 15/09): leia o artigo do teletrabalho no Serpro (Biblioteca) e anote 2 pontos positivos e 2 negativos por ator — cite os % exatos dos Quadros 1-6',
      'Atividade avaliativa ESCRITA: QUARTA 21/10, 08:40–11:25 (M3–M5) na sala S19 — única aula da RHT na grade oficial do campus. Cobre TODO o conteúdo dado até hoje — revise os slides do 1º bimestre + leituras de apoio (Djamila Ribeiro e documentário GIG) antes dela',
    ],
    prioridade: 'media',
    ordemEstudo: [
      '1. Leia os textos indicados ANTES da aula',
      '2. Faça resumos de cada unidade',
      '3. Conecte conceitos com situações reais (notícias, experiências)',
      '4. Prepare apresentação do seminário com antecedência',
      '5. Pratique argumentação para os debates',
    ],
    datasImportantes: [
      { data: 'Qua 21/10 · 08:40', descricao: 'Atividade avaliativa ESCRITA (M3–M5, sala S19) — todo o conteúdo dado até hoje' },
      { data: 'Semana 14', descricao: 'Apresentação do Seminário (peso 40%)' },
    ],
  },
  {
    code: 'ING.001',
    name: 'Inglês Instrumental',
    shortName: 'Inglês',
    chTotal: 33,
    chWeekly: 2,
    professor: 'Daniela Miguel de Souza Morais',
    professorTitle: 'Mestrado',
    period: '2026.2',
    category: 'linguagens',
    color: 'teal',
    icon: 'Languages',
    ementa: 'Conscientização do processo de leitura. Estratégias de leitura: skimming, scanning, prediction, selectivity. Uso do dicionário. Aspectos gramaticais. Reconhecimento e produção de gêneros textuais escritos em inglês. Interpretação de textos em língua inglesa, em especial da área de informática e temáticas ambientais.',
    conteudoProgramatico: [
      { unidade: 'Leitura e estratégias', topicos: ['Introdução à leitura e compreensão de textos',
        'Estratégias: Predição, Skimming, Scanning', 'Cognatos e Falsos cognatos'] },
      { unidade: 'Gêneros e gramática', topicos: ['A prática da leitura e os gêneros textuais',
        'Grupos nominais', 'Tempos verbais', 'Uso do dicionário', 'Glossário de termos técnicos'] },
      { unidade: 'Temática ambiental', topicos: ['Questões ambientais ligadas à TIC'] },
    ],
    objetivos: { geral: 'Compreender a importância do inglês instrumental para o desenvolvimento de estratégias de leitura e compreensão de textos.',
      especificos: [
        'Usar estratégias de leitura para compreensão de textos em inglês',
        'Reconhecer cognatos e falsos cognatos',
        'Identificar gêneros textuais (revistas, sites, jornais)',
        'Utilizar o dicionário como fonte de auxílio',
        'Compreender relações léxico-gramaticais',
        'Usar termos técnicos para ler e compreender textos',
        'Refletir sobre questões ambientais ligadas à TIC',
      ] },
    avaliacao: '6 atividades avaliativas (3 para N1, 3 para N2). MF = (N1 + N2)/2, onde N1 = (A1+A2+A3)/3 e N2 = (B1+B2+B3)/3. Escala 0-10.',
    evaluationMethod: 'media_atividades',
    gradeComponents: [
      { name: 'A1', weight: 16.67, scale: 10, description: 'Atividade 1 (N1)' },
      { name: 'A2', weight: 16.67, scale: 10, description: 'Atividade 2 (N1)' },
      { name: 'A3', weight: 16.66, scale: 10, description: 'Atividade 3 (N1)' },
      { name: 'B1', weight: 16.67, scale: 10, description: 'Atividade 4 (N2)' },
      { name: 'B2', weight: 16.67, scale: 10, description: 'Atividade 5 (N2)' },
      { name: 'B3', weight: 16.66, scale: 10, description: 'Atividade 6 (N2)' },
    ],
    approvalThreshold: 7,
    finalExamThreshold: 4,
    scale: 10,
    bibliografiaBasica: [
      'GALLO, L. R. Inglês Instrumental para informática. Ícone, 3ª ed., 2014.',
      'GLENDINNING, E; HOLMSTROM, B. Study reading. Cambridge, 1992.',
      'GLENDINNING, E; McEWAN, J. Basic English for Computing. Oxford, 2003.',
    ],
    bibliografiaComplementar: [
      'Collins dicionário escolar inglês-português. Disal, 2ª ed., 2010.',
      'GREENALL, S.; PYE, D. Reading 2. Cambridge, 1991.',
      'Inglês + fácil: gramática. Larousse, 2006.',
      'MARINOTTO, D. Reading on info tech. Novatec, 2ª ed., 2008.',
      'MURPHY, R. Essential grammar in use. Cambridge, 2ª ed., 1997.',
    ],
    dicasEstudo: [
      'Leia textos em inglês da área de TI todos os dias (15 min)',
      'Monte um glossário pessoal de termos técnicos',
      'Pratique skimming (ideia geral) e scanning (info específica)',
      'Cuidado com falsos cognatos (ex: actual ≠ atual, pretend ≠ pretender)',
      'Use filmes/séries com legenda em inglês para imersão',
      'Assista ao vídeo indicado pelo prof. Fernando (16/09): "15 partes do corpo que também são VERBOS" — anote os 15 pares substantivo/verbo no seu glossário (Biblioteca)'
    ],
    prioridade: 'media',
    ordemEstudo: [
      '1. Estude estratégias de leitura (skimming, scanning, prediction)',
      '2. Memorize lista de cognatos e falsos cognatos',
      '3. Leia 1 texto em inglês por dia (15 min)',
      '4. Monte glossário pessoal de termos técnicos',
      '5. Pratique grupos nominais e tempos verbais',
      '6. Faça todas as 6 atividades no prazo',
    ],
    datasImportantes: [
      { data: 'Semana 8', descricao: 'N1 - Conjunto de 3 atividades (A1+A2+A3)' },
      { data: 'Semana 16', descricao: 'N2 - Conjunto de 3 atividades (B1+B2+B3)' },
    ],
  },
  {
    code: 'PORT.001',
    name: 'Português Instrumental',
    shortName: 'Português',
    chTotal: 33,
    chWeekly: 2,
    professor: 'Francisco Igor Arraes Alves Rocha',
    professorTitle: 'Mestrado',
    period: '2026.2',
    category: 'linguagens',
    color: 'cyan',
    icon: 'BookOpen',
    // EMENTA OFICIAL — plano de disciplina 0576 assinado em 15/02/2026 (SUAP 836330)
    ementa:
      'A Língua portuguesa como interação comunicativa. Diferentes concepções textuais. Modos de produção textual científica. Conceitos linguísticos. Níveis de linguagem, variações linguísticas. Teoria da Comunicação. Leitura e interpretação de textos diversos. Tipologia textual. Parágrafo padrão. Técnica de resumo. Técnicas de argumentação; estrutura e características do texto dissertativo, elementos de textualidade. Noções linguístico gramaticais aplicadas ao texto.',
    conteudoProgramatico: [
      { unidade: 'Unidade I: As diferentes concepções de linguagem', topicos: [
        'Linguagem e cognição', 'Modalidades da língua', 'As variações linguísticas',
        'Tipos de variações linguísticas', 'Teoria da comunicação', 'O texto',
        'Tipologia textual e gêneros textuais', 'Tipos textuais', 'Textualidade',
        'Propriedades da textualidade', 'Compreensão de texto',
        'O texto literário / o texto não literário',
      ] },
      { unidade: 'Unidade II: Técnicas de produção textual aplicadas ao texto acadêmico', topicos: [
        'O parágrafo', 'Palavras e ideias chave', 'Dissertação argumentativa',
        'Estrutura da dissertação', 'O Resumo', 'Resumo indicativo',
        'Resumo informativo', 'Resumo crítico',
      ] },
      { unidade: 'Unidade III: Orientações gramaticais', topicos: [
        'Noções básicas de morfossintaxe', 'Regras de pontuação',
      ] },
    ],
    objetivos: {
      geral: 'Entender a linguagem como atividade interativa, sócio-comunicativa através da qual se estabelecem as relações sociais e dominar os aspectos fundamentais do processo comunicativo com ênfase na diversidade linguística.',
      especificos: [
        'Fazer leitura crítico-analítica de diferentes gêneros textuais',
        'Analisar e redigir textos argumentativos',
        'Reconhecer a diversidade linguística',
        'Resumir e analisar textos diversos',
        'Produzir textos de diversas tipologias',
      ],
    },
    // Oficial: avaliação qualitativa e quantitativa — escritas individuais + trabalhos
    // em equipe + produção de gêneros textuais + participação oral e escrita
    avaliacao: 'Avaliação qualitativa e quantitativa: avaliações escritas individuais e trabalhos em equipe; produção de gêneros textuais específicos; pontuação atribuída à participação oral e escrita durante as aulas.',
    evaluationMethod: 'continua_formativa',
    gradeComponents: [
      { name: 'Produções textuais', weight: 60, scale: 10, description: 'Escritas individuais e trabalhos em equipe — produção de gêneros textuais específicos' },
      { name: 'Participação', weight: 40, scale: 10, description: 'Participação oral e escrita durante as aulas (qualitativa)' },
    ],
    approvalThreshold: 7,
    finalExamThreshold: 4,
    scale: 10,
    bibliografiaBasica: [
      'BECHARA, E. Moderna Gramática da Língua Portuguesa. 37ª ed. Nova Fronteira.',
      'GARCIA, O. M. Comunicação em Prosa Moderna. 27ª ed. FGV, 2010.',
      'FIORIN, J. L.; SAVIOLI, F. P. Para entender o texto: leitura e redação.',
    ],
    bibliografiaComplementar: [
      'ABAURRE, M. L.; ABAURRE, M. B. M.; PONTARA, M. N. Português: Contexto, interlocução e Sentido. Moderna, 2010.',
      'SARMENTO, L. L. Oficina de redação. Vol. único. Moderna.',
      'VIANA, A. C. Roteiro de redação: lendo e argumentando. Scipione.',
      'ORLANDI, E. P. Análise de discurso: princípios e procedimentos. 5ª ed. Pontes.',
    ],
    dicasEstudo: [
      'Material da aula é FÍSICO (apostila em papel) — fotografe a página do dia e anexe ao tutor para estudar junto',
      'Leia ativamente - sublinhe e faça anotações',
      'Pratique a produção de resumos e resenhas',
      'Revise concordância e regência semanalmente',
      'Faça exercícios de interpretação de texto variados',
    ],
    prioridade: 'baixa',
    ordemEstudo: [
      '1. Leia ativamente fazendo anotações',
      '2. Pratique resumos e resenhas',
      '3. Revise concordância e regência',
      '4. Faça exercícios de interpretação',
    ],
    datasImportantes: [],
  },
];

// Materiais - agora com PDFs servidos de /pdfs/ e resumos de /data/ai-summaries/
export const materials: Material[] = [
  // Matemática Aplicada à Computação
  { id: 'mat-logica-slides', disciplineCode: 'TEC.1984', title: 'Noções de Lógica - Slides (47 páginas)',
    type: 'slides', pdfPath: '/pdfs/mat-logica-slides.pdf',
    summaryFile: 'mat-logica-slides.summary.json', pages: 47, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['2. Lógica Matemática'],
  },
  { id: 'mat-logica-lista', disciplineCode: 'TEC.1984', title: 'Lógica Matemática - Lista de Exercícios',
    type: 'lista_exercicios', pdfPath: '/pdfs/mat-logica-lista.pdf',
    summaryFile: 'mat-logica-lista.summary.json', pages: 2, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['2. Lógica Matemática'],
  },
  { id: 'mat-ementa', disciplineCode: 'TEC.1984', title: 'Plano de Disciplina - Matemática',
    type: 'ementa', pdfPath: '/data/ementas/ementa-matematica.pdf',
    summaryFile: 'matematica-ementa.summary.json', source: 'ifpb_site' },
  // Algoritmos
  { id: 'alg-lista', disciplineCode: 'TEC.1687', title: 'Lista de Exercícios de Programação (43 páginas)',
    type: 'lista_exercicios', pdfPath: '/pdfs/alg-lista-exercicios.pdf',
    summaryFile: 'alg-lista.summary.json', pages: 43, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['Unidade 1: Noções de algoritmos e programação', 'Unidade 2: Desvios condicionais', 'Unidade 3: Comandos de repetição'],
  },
  { id: 'alg-questoes-semana1', disciplineCode: 'TEC.1687', title: 'Questões da Semana 1 (Classroom, 09/09)',
    type: 'lista_exercicios', pdfPath: '/pdfs/alg-questoes-semana1.pdf',
    summaryFile: 'alg-questoes-semana1.summary.json', pages: 1, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['Unidade 1: Noções de algoritmos e programação'],
  },
  { id: 'alg-videoaulas', disciplineCode: 'TEC.1687', title: 'Videoaulas (Google Drive)',
    type: 'video', summaryFile: 'alg-videoaulas.summary.json', source: 'external',
    externalUrl: 'https://drive.google.com/drive/folders/1QFBEca75o9E-Vd65rDdg2wktqasDzHIx',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['Unidade 1: Noções de algoritmos e programação', 'Unidade 2: Desvios condicionais', 'Unidade 3: Comandos de repetição'],
  },
  { id: 'alg-questoes-semana2', disciplineCode: 'TEC.1687', title: 'Questões da Semana 2 (Classroom, 17/09)',
    type: 'lista_exercicios', pdfPath: '/pdfs/alg-questoes-semana2.pdf',
    summaryFile: 'alg-questoes-semana2.summary.json', pages: 2, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['Unidade 1: Noções de algoritmos e programação', 'Unidade 3: Comandos de repetição'],
  },
  { id: 'alg-questoes-semana3', disciplineCode: 'TEC.1687', title: 'Questões da Semana 3 (Classroom, 23/09)',
    type: 'lista_exercicios', pdfPath: '/pdfs/alg-questoes-semana3.pdf',
    summaryFile: 'alg-questoes-semana3.summary.json', pages: 1, source: 'user_upload',
    // Material-first: 8 questões 100% de desvios condicionais — comprova que a
    // Unidade 2 está sendo dada (exatamente o escopo da Prova 1, 30/10).
    topicosCobertos: ['Unidade 2: Desvios condicionais'],
  },
  { id: 'alg-questoes-semana4', disciplineCode: 'TEC.1687', title: 'Questões da Semana 4 (Classroom)',
    type: 'lista_exercicios', pdfPath: '/pdfs/alg-questoes-semana4.pdf',
    summaryFile: 'alg-questoes-semana4.summary.json', pages: 2, source: 'user_upload',
    // Material-first: mais 8 questões de desvios condicionais (nível acima da
    // S3: switch, recorte de dígitos, fuso) — reforça o escopo da Prova 1, 30/10.
    topicosCobertos: ['Unidade 2: Desvios condicionais'],
  },
  // A ESCADINHA (dono, 13/10/2026: "em algoritmos a depender do assunto pode
  // ser bom iniciar da base pois é uma escadinha") — a S5 É o degrau da base
  // (laço simples) e a S6 o degrau de cima (aninhamento). A ordem de estudo
  // entre elas vive em material-curation.ts (LADDER), não aqui.
  { id: 'alg-questoes-semana5', disciplineCode: 'TEC.1687', title: 'Questões da Semana 5 (Classroom) — repetição na base',
    type: 'lista_exercicios', pdfPath: '/pdfs/alg-questoes-semana5.pdf',
    summaryFile: 'alg-questoes-semana5.summary.json', pages: 2, source: 'user_upload',
    // Material-first: 11 questões 100% de repetição simples (for/while,
    // contador, acumulador, string caractere a caractere) — a Unidade 3 dada.
    topicosCobertos: ['Unidade 3: Comandos de repetição'],
  },
  { id: 'alg-questoes-semana6', disciplineCode: 'TEC.1687', title: 'Questões da Semana 6 (Classroom) — aninhamento (o degrau de cima)',
    type: 'lista_exercicios', pdfPath: '/pdfs/alg-questoes-semana6.pdf',
    summaryFile: 'alg-questoes-semana6.summary.json', pages: 2, source: 'user_upload',
    // Material-first: 10 questões de laços ANINHADOS (pares, perfeito,
    // Fibonacci, votação, palíndromos, figuras) — S5 + laço dentro do laço.
    topicosCobertos: ['Unidade 3: Comandos de repetição'],
  },
  { id: 'alg-programas-c-autorais', disciplineCode: 'TEC.1687', title: 'Programas C do autor — aula + Questões da Semana 1 (19 resolvidos)',
    type: 'exemplo', summaryFile: 'alg-programas-c-autorais.summary.json', source: 'user_upload',
    // Material-first: as soluções autorais comprovam DOMÍNIO da Unidade 1 (lidas/compiladas/rodadas)
    topicosCobertos: ['Unidade 1: Noções de algoritmos e programação'],
  },
  { id: 'alg-monitoria-discord', disciplineCode: 'TEC.1687', title: 'Monitoria — Servidor no Discord (Everton)',
    type: 'web_page', summaryFile: 'alg-monitoria-discord.summary.json', source: 'external',
    externalUrl: 'https://discord.gg/XyTmDhE5Dt' },
  { id: 'alg-ementa', disciplineCode: 'TEC.1687', title: 'Plano de Disciplina - Algoritmos',
    type: 'ementa', pdfPath: '/data/ementas/ementa-algoritmos.pdf',
    summaryFile: 'algoritmo-ementa.summary.json', source: 'ifpb_site' },
  // Linguagem de Marcação
  { id: 'lm-intro-00', disciplineCode: 'TEC.1632', title: 'Introdução a Linguagens de Marcação',
    type: 'introducao', pdfPath: '/pdfs/lm-00-introducao.pdf',
    summaryFile: 'lm-00-introducao.summary.json', source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['Introdução a Linguagens de Marcação'],
  },
  { id: 'lm-01-estrutura', disciplineCode: 'TEC.1632', title: 'HTML - Estrutura básica, elementos, atributos, títulos e parágrafos (32 slides)',
    type: 'slides', pdfPath: '/pdfs/lm-html-01-estrutura.pdf',
    summaryFile: 'lm-html-01-estrutura.summary.json', pages: 32, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  { id: 'lm-intro-html', disciplineCode: 'TEC.1632', title: 'Introdução a HTML (web)',
    type: 'web_page', pdfPath: '/pdfs/lm-html-introducao.pdf',
    summaryFile: 'lm-html-introducao.summary.json', source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  { id: 'lm-tags', disciplineCode: 'TEC.1632', title: 'Tags e elementos (web)',
    type: 'web_page', pdfPath: '/pdfs/lm-html-tags.pdf',
    summaryFile: 'lm-html-tags.summary.json', source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  { id: 'lm-atributos', disciplineCode: 'TEC.1632', title: 'Atributos e valores (web)',
    type: 'web_page', pdfPath: '/pdfs/lm-html-atributos.pdf',
    summaryFile: 'lm-html-atributos.summary.json', source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  { id: 'lm-titulos', disciplineCode: 'TEC.1632', title: 'Títulos e Parágrafos (web)',
    type: 'web_page', pdfPath: '/pdfs/lm-html-titulos-paragrafos.pdf',
    summaryFile: 'lm-html-titulos.summary.json', source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  { id: 'lm-listas-slides', disciplineCode: 'TEC.1632', title: 'Listas - Slides',
    type: 'slides', pdfPath: '/pdfs/lm-html-02-listas.pdf',
    summaryFile: 'lm-html-02-listas.summary.json', source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  { id: 'lm-listas-web', disciplineCode: 'TEC.1632', title: 'Listas (web)',
    type: 'web_page', pdfPath: '/pdfs/lm-html-listas.pdf',
    summaryFile: 'lm-html-listas.summary.json', source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  // NOVOS MATERIAIS — LM (aulas 03 e 04, enviadas pelo usuário em 11/09)
  { id: 'lm-html-03-hyperlinks', disciplineCode: 'TEC.1632', title: 'HTML - Hyperlinks (16 slides)',
    type: 'slides', pdfPath: '/pdfs/lm-html-03-hyperlinks.pdf',
    summaryFile: 'lm-html-03-hyperlinks.summary.json', pages: 16, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  { id: 'lm-html-04-midias', disciplineCode: 'TEC.1632', title: 'HTML - Mídias: Imagens, Áudio e Vídeo (17 slides)',
    type: 'slides', pdfPath: '/pdfs/lm-html-04-midias.pdf',
    summaryFile: 'lm-html-04-midias.summary.json', pages: 17, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  // Apostila digital da disciplina (gitbook do Prof. Diogo) — complemento das aulas
  { id: 'lm-web-hyperlinks', disciplineCode: 'TEC.1632', title: 'Hyperlinks (web — apostila da disciplina)',
    type: 'web_page', summaryFile: 'lm-gitbook-hyperlinks.summary.json', source: 'external',
    externalUrl: 'https://diogomoreira.gitbook.io/linguagens-de-marcacao/html/hyperlinks',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  { id: 'lm-web-urls', disciplineCode: 'TEC.1632', title: 'URLs (web — apostila da disciplina)',
    type: 'web_page', summaryFile: 'lm-gitbook-urls.summary.json', source: 'external',
    externalUrl: 'https://diogomoreira.gitbook.io/linguagens-de-marcacao/html/urls',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  { id: 'lm-web-imagens', disciplineCode: 'TEC.1632', title: 'Imagens (web — apostila da disciplina)',
    type: 'web_page', summaryFile: 'lm-gitbook-imagens.summary.json', source: 'external',
    externalUrl: 'https://diogomoreira.gitbook.io/linguagens-de-marcacao/html/imagens',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  { id: 'lm-web-audio', disciplineCode: 'TEC.1632', title: 'Áudio (web — apostila da disciplina)',
    type: 'web_page', summaryFile: 'lm-gitbook-audio.summary.json', source: 'external',
    externalUrl: 'https://diogomoreira.gitbook.io/linguagens-de-marcacao/html/audio',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  { id: 'lm-web-video', disciplineCode: 'TEC.1632', title: 'Vídeo (web — apostila da disciplina)',
    type: 'web_page', summaryFile: 'lm-gitbook-video.summary.json', source: 'external',
    externalUrl: 'https://diogomoreira.gitbook.io/linguagens-de-marcacao/html/video',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  // NOVO MATERIAL — LM aula 05 (Classroom 17/09: "Tabelas"; o array pulava da aula 04 para a 06)
  { id: 'lm-web-tabelas', disciplineCode: 'TEC.1632', title: 'Tabelas (web — apostila da disciplina)',
    type: 'web_page', summaryFile: 'lm-gitbook-tabelas.summary.json', source: 'external',
    externalUrl: 'https://diogomoreira.gitbook.io/linguagens-de-marcacao/html/tabelas',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  // NOVOS MATERIAIS — LM aula 06 (enviados pelo usuário em 19/09)
  { id: 'lm-html-06-formularios', disciplineCode: 'TEC.1632', title: 'HTML - Formulários (20 slides)',
    type: 'slides', pdfPath: '/pdfs/lm-html-06-formularios.pdf',
    summaryFile: 'lm-html-06-formularios.summary.json', pages: 20, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  { id: 'lm-exemplo-formularios', disciplineCode: 'TEC.1632', title: 'Exemplo de Formulário da aula (index.html — renderiza ao vivo)',
    type: 'exemplo', pdfPath: '/pdfs/lm-exemplo-formularios.html',
    summaryFile: 'lm-exemplo-formularios.summary.json', source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  { id: 'lm-web-formularios', disciplineCode: 'TEC.1632', title: 'Formulários (web — apostila da disciplina)',
    type: 'web_page', summaryFile: 'lm-gitbook-formularios.summary.json', source: 'external',
    externalUrl: 'https://diogomoreira.gitbook.io/linguagens-de-marcacao/html/formularios',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  // NOVOS MATERIAIS — LM aula 07 (enviados pelo usuário em 24/09)
  { id: 'lm-html-07-metadados', disciplineCode: 'TEC.1632', title: 'HTML - Metadados (19 slides)',
    type: 'slides', pdfPath: '/pdfs/lm-html-07-metadados.pdf',
    summaryFile: 'lm-html-07-metadados.summary.json', pages: 19, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  { id: 'lm-web-metadados', disciplineCode: 'TEC.1632', title: 'Metadados (web — apostila da disciplina)',
    type: 'web_page', summaryFile: 'lm-gitbook-metadados.summary.json', source: 'external',
    externalUrl: 'https://diogomoreira.gitbook.io/linguagens-de-marcacao/html/metadados',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['HTML'],
  },
  // NOVO MATERIAL — LM aula 08 (Classroom 01/10: "Introdução e Seletores") — a PRIMEIRA aula de
  // CSS: é a base da A2 (codificação visual, 45% da nota). Capítulos intro + seletores da apostila.
  { id: 'lm-web-css-seletores', disciplineCode: 'TEC.1632', title: 'Introdução a CSS e Seletores (web — apostila da disciplina)',
    type: 'web_page', summaryFile: 'lm-gitbook-css-seletores.summary.json', source: 'external',
    externalUrl: 'https://diogomoreira.gitbook.io/linguagens-de-marcacao/css/introducao-a-css',
    // Material-first: comprova aula de CSS (curriculum-state.ts)
    topicosCobertos: ['CSS'],
  },
  // ATIVIDADE VALE NOTA (13/10/2026): site pessoal em HTML PURO, 4 páginas,
  // sem CSS — Etapa 1 da construção do site. O retorno prático de toda a
  // matéria HTML dada até aqui; regras duras (W3C válido, nada de style).
  { id: 'lm-atividade-individual', disciplineCode: 'TEC.1632', title: 'Atividade Individual — site pessoal em HTML puro (vale nota)',
    type: 'lista_exercicios', pdfPath: '/pdfs/lm-atividade-individual.pdf',
    summaryFile: 'lm-atividade-individual.summary.json', pages: 2, source: 'user_upload',
    // Material-first: a atividade mobiliza TUDO do HTML dado (estrutura,
    // listas, mídias, hyperlinks, formulários) — comprova a unidade HTML.
    topicosCobertos: ['HTML'],
  },
  { id: 'lm-ementa', disciplineCode: 'TEC.1632', title: 'Plano de Disciplina - Linguagens de Marcação',
    type: 'ementa', pdfPath: '/data/ementas/ementa-linguagens-marcacao.pdf',
    summaryFile: 'LM-ementa.summary.json', source: 'ifpb_site' },
  // Ementas das outras disciplinas
  { id: 'rht-ementa', disciplineCode: 'TEC.0953', title: 'Plano de Disciplina - RHT',
    type: 'ementa', pdfPath: '/data/ementas/ementa-rht.pdf',
    summaryFile: 'RHT-ementa.summary.json', source: 'ifpb_site' },
  { id: 'rht-teletrabalho-serpro', disciplineCode: 'TEC.0953',
    title: 'Artigo: Teletrabalho no Serpro (RSP, 2021) — Proposta de Atividade I',
    type: 'pdf', pdfPath: '/pdfs/rht-teletrabalho-serpro.pdf',
    summaryFile: 'rht-teletrabalho-serpro.summary.json', pages: 30, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['II. Trabalho humano no Brasil'],
  },
  // NOVOS MATERIAIS RHT (13/10/2026, Prof.ª Marília Aguiar — enviados pelo dono)
  { id: 'rht-aulas-1o-bimestre', disciplineCode: 'TEC.0953',
    title: 'Aulas 1º bimestre — O trabalho no Brasil e RT contemporâneo (112 slides)',
    type: 'slides', pdfPath: '/pdfs/rht-aulas-1o-bimestre.pdf',
    summaryFile: 'rht-aulas-1o-bimestre.summary.json', pages: 112, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts) — CLT, flexibilização,
    // uberização, trabalho análogo à escravidão, racismo institucional e assédio
    topicosCobertos: ['II. Trabalho humano no Brasil', 'III. Ética no trabalho'],
  },
  { id: 'rht-manual-antirracista', disciplineCode: 'TEC.0953',
    title: 'Pequeno Manual Antirracista (Djamila Ribeiro) — leitura de apoio (foco: Enxergue a negritude + Transforme seu ambiente de trabalho)',
    type: 'pdf', pdfPath: '/pdfs/rht-pequeno-manual-antirracista.pdf',
    summaryFile: 'rht-manual-antirracista.summary.json', pages: 69, source: 'user_upload' },
  { id: 'rht-documentario-gig', disciplineCode: 'TEC.0953',
    title: 'Documentário: GIG — a Uberização do Trabalho (Reporter Brasil, YouTube)',
    type: 'video',
    externalUrl: 'https://reporterbrasil.org.br/documentarios/gig',
    summaryFile: 'rht-documentario-gig.summary.json', source: 'external' },
  { id: 'fund-ementa', disciplineCode: '53647', title: 'Plano de Disciplina - Fundamentos',
    type: 'ementa', pdfPath: '/data/ementas/ementa-fundamentos.pdf',
    summaryFile: 'fundamentos-ementa.summary.json', source: 'ifpb_site' },
  // NOVOS MATERIAIS — Fundamentos (slides do Prof. André, enviados 06/10)
  { id: 'fund-02-historia-computacao', disciplineCode: '53647', title: 'História da Computação — Hardware: Evolução e Conceitos (127 slides)',
    type: 'slides', pdfPath: '/pdfs/fund-02-historia-computacao.pdf',
    summaryFile: 'fund-02-historia-computacao.summary.json', pages: 127, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['Hardware e Software'],
  },
  { id: 'fund-01-notacoes-numericas', disciplineCode: '53647', title: 'Notações Numéricas — Representação da Informação (46 slides)',
    type: 'slides', pdfPath: '/pdfs/fund-01-notacoes-numericas.pdf',
    summaryFile: 'fund-01-notacoes-numericas.summary.json', pages: 46, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['Representação de Dados'],
  },
  { id: 'ing-ementa', disciplineCode: 'ING.001', title: 'Plano de Disciplina - Inglês',
    type: 'ementa', pdfPath: '/data/ementas/ementa-ingles.pdf',
    summaryFile: 'ingles-ementa.summary.json', source: 'ifpb_site' },
  // Ementa oficial de Português (SUAP 836330 — baixada do estudante.ifpb.edu.br)
  { id: 'port-ementa', disciplineCode: 'PORT.001', title: 'Plano de Disciplina - Português Instrumental (0576)',
    type: 'ementa', pdfPath: '/data/ementas/ementa-portugues.pdf',
    summaryFile: 'port-ementa.summary.json', source: 'ifpb_site' },
  // Calendário acadêmico
  { id: 'calendario', disciplineCode: 'PNAAT', title: 'Calendário Acadêmico Semestral 2026',
    type: 'calendar', pdfPath: '/pdfs/calendario-semestral.pdf',
    summaryFile: 'calendario.summary.json', source: 'ifpb_site' },
  // Provas reais (fotos enviadas pelo usuário)
  { id: 'prova-fund-av1', disciplineCode: '53647', title: 'Prova Av1 - Fundamentos da Computação (Prof. André)',
    type: 'image', pdfPath: '/pdfs/prova-andre-av1-fundamentos.jpg',
    summaryFile: 'prova-fund-av1.summary.json', source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['Hardware e Software', 'Representação de Dados'],
  },
  { id: 'cronograma-ivs', disciplineCode: 'PNAAT', title: 'Edital IVS - Cronograma (2026.2)',
    type: 'image', pdfPath: '/pdfs/cronograma-ivs.jpg',
    summaryFile: 'cronograma-ivs.summary.json', source: 'user_upload' },
  // PNAAT
  { id: 'pnaat-cursos', disciplineCode: 'PNAAT', title: 'PNAAT - Meus Cursos (PDF)',
    type: 'pdf', pdfPath: '/pdfs/PNAAT-Meus-cursos.pdf',
    summaryFile: 'pnaat-cursos.summary.json', source: 'pnaat' },
  { id: 'pnaat-parceiros', disciplineCode: 'PNAAT', title: 'PNAAT Parceiros - Cajazeiras',
    type: 'pdf', pdfPath: '/pdfs/pnaat-parceiros-cajazeiras.pdf',
    summaryFile: 'pnaat-parceiros-cajazeiras.summary.json', source: 'user_upload' },
  // Documentos institucionais diversos
  { id: 'apresentacao-curso', disciplineCode: 'PNAAT', title: 'Apresentação do Curso ADS (Recepção 2026)',
    type: 'pdf', pdfPath: '/pdfs/apresentacao-curso-2026.pdf',
    summaryFile: 'apresentacao-curso-2026.summary.json', source: 'user_upload' },
  { id: 'caest-apoio', disciplineCode: 'PNAAT', title: 'CAEST - Coordenação de Apoio ao Estudante',
    type: 'pdf', pdfPath: '/pdfs/caest-apoio-estudante.pdf',
    summaryFile: 'caest-apoio-estudante.summary.json', source: 'user_upload' },
  { id: 'loopis-jr', disciplineCode: 'PNAAT', title: 'Loopis Jr - Empresa Júnior do ADS',
    type: 'pdf', pdfPath: '/pdfs/loopis-empresa-junior.pdf',
    summaryFile: 'loopis-empresa-junior.summary.json', source: 'user_upload' },
  { id: 'regulamento-didatico', disciplineCode: 'PNAAT', title: 'Regulamento Didático ADS',
    type: 'pdf', pdfPath: '/pdfs/regulamento-didatico.pdf',
    summaryFile: 'regulamento-didatico.summary.json', source: 'user_upload' },
  { id: 'regulamento-disciplinar', disciplineCode: 'PNAAT', title: 'Regulamento Disciplinar (Res. 123/2011)',
    type: 'pdf', pdfPath: '/pdfs/regulamento-disciplinar.pdf',
    summaryFile: 'regulamento-disciplinar.summary.json', source: 'user_upload' },
  // NOVOS MATERIAIS — Matemática (Matrizes)
  { id: 'mat-00-matrizes', disciplineCode: 'TEC.1984', title: 'Matrizes — Aula 00 (Slides)',
    type: 'slides', pdfPath: '/pdfs/mat-00-matrizes.pdf',
    summaryFile: 'mat-00-matrizes.summary.json', source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['1. Álgebra Matricial'],
  },
  { id: 'mat-01-matrizes', disciplineCode: 'TEC.1984', title: 'Matrizes — Aula 01 (Lista)',
    type: 'lista_exercicios', pdfPath: '/pdfs/mat-01-matrizes.pdf',
    summaryFile: 'mat-01-matrizes.summary.json', source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['1. Álgebra Matricial'],
  },
  // O tópico VIVO da matemática agora: Determinantes (prof. Eudes) — teoria +
  // lista 20 questões. GATE FINO: liberam o sub-tópico 'Determinantes' dentro
  // da Unidade 1 (topicosCobertosFino — curriculum-state.ts).
  { id: 'mat-determinantes-teoria', disciplineCode: 'TEC.1984', title: 'Determinantes — Teoria da aula (prof. Eudes)',
    type: 'slides', pdfPath: '/pdfs/mat-determinantes-teoria.pdf',
    summaryFile: 'mat-determinantes-teoria.summary.json', pages: 4, source: 'user_upload',
    topicosCobertos: ['1. Álgebra Matricial'],
    topicosCobertosFino: ['Determinantes'],
  },
  { id: 'mat-determinantes-lista', disciplineCode: 'TEC.1984', title: 'Determinantes — Lista (20 questões, prof. Eudes)',
    type: 'lista_exercicios', pdfPath: '/pdfs/mat-determinantes-lista.pdf',
    summaryFile: 'mat-determinantes-lista.summary.json', pages: 2, source: 'user_upload',
    topicosCobertos: ['1. Álgebra Matricial'],
    topicosCobertosFino: ['Determinantes'],
  },
  // t180 — A folha da prova: as questões do professor (espelhos extraídos do
  // áudio 30/09 + listas reais), tipografadas em LaTeX. Vive COMO MATERIAL
  // (abre na tela dividida PDF + Tutor como qualquer outro) — sem modo especial.
  { id: 'mat-av1-questoes-professor', disciplineCode: 'TEC.1984',
    title: 'Av1 — As questões do professor (espelhos das listas)',
    type: 'lista_exercicios', pdfPath: '/pdfs/mat-av1-questoes-professor.pdf',
    summaryFile: 'mat-av1-questoes-professor.summary.json', pages: 6, source: 'user_upload' },
  // NOVOS MATERIAIS — Algoritmos (Slides gerais + Tipos/Operadores)
  { id: 'alg-slides-geral', disciplineCode: 'TEC.1687', title: 'Algoritmos — Slides Gerais (64 páginas, Prof. Fábio)',
    type: 'slides', pdfPath: '/pdfs/alg-slides-geral.pdf',
    summaryFile: 'alg-slides-geral.summary.json', pages: 64, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['Unidade 1: Noções de algoritmos e programação', 'Unidade 2: Desvios condicionais', 'Unidade 3: Comandos de repetição'],
  },
  { id: 'alg-tipos-operadores', disciplineCode: 'TEC.1687', title: 'Tipos de Variáveis e Operadores (Prof. Fábio)',
    type: 'slides', pdfPath: '/pdfs/alg-tipos-operadores.pdf',
    summaryFile: 'alg-tipos-operadores.summary.json', pages: 16, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['Unidade 1: Noções de algoritmos e programação'],
  },
  // NOVO MATERIAL — Inglês (Vocabulário)
  { id: 'ing-vocabulario', disciplineCode: 'ING.001', title: 'Vocabulário Básico 2026',
    type: 'slides', pdfPath: '/pdfs/ing-vocabulario.pdf',
    summaryFile: 'ing-vocabulario.summary.json', pages: 11, source: 'user_upload',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['Leitura e estratégias', 'Gêneros e gramática'],
  },
  // NOVO MATERIAL — Inglês (vídeo do Classroom, 16/09)
  { id: 'ing-video-corpo-verbos', disciplineCode: 'ING.001',
    title: 'Vídeo: 15 partes do corpo que também são VERBOS (16 min)',
    type: 'video', summaryFile: 'ing-video-corpo-verbos.summary.json', source: 'external',
    externalUrl: 'https://www.youtube.com/watch?v=cCZPY-dgGMI',
    // Material-first: comprova aula (curriculum-state.ts)
    topicosCobertos: ['Gêneros e gramática'],
  },
];

export interface CalendarEvent {
  date: string; // ISO format YYYY-MM-DD
  dateLabel: string;
  title: string;
  category: 'feriado' | 'avaliacao' | 'aula' | 'recesso' | 'outro';
  relatedDiscipline?: string;
}

export const calendarEvents: CalendarEvent[] = [
  // 2026.2 — turma atual do dono (2ª ingressante do ano; NÃO é um período)
  { date: '2026-09-01', dateLabel: '01-15/Set', title: 'Edital IVS - Inscrições (SUAP)', category: 'outro' },
  { date: '2026-09-15', dateLabel: '15/Set', title: 'Último dia inscrição IVS', category: 'outro' },
  { date: '2026-09-16', dateLabel: '16/Set-02/Out', title: 'IVS - Análise Socioeconômica', category: 'outro' },
  // Fonte: dono (mesma data do marco do simulado — ver math-exam-prep.ts).
  // Sem categoria 'avaliacao' de propósito: a nota da S3 não está confirmada,
  // o que a fonte garante é a ENTREGA no Classroom.
  { date: '2026-09-29', dateLabel: '29/Set', title: 'Algoritmos - Entrega da S3 (programas, Classroom)', category: 'outro', relatedDiscipline: 'TEC.1687' },
  { date: '2026-10-05', dateLabel: '05-06/Out', title: 'IVS - Entrevistas', category: 'outro' },
  { date: '2026-10-07', dateLabel: '07/Out', title: 'IVS - Resultado Preliminar', category: 'outro' },
  { date: '2026-10-09', dateLabel: '09/Out', title: 'LM - Projeto 1ª etapa: entrega + apresentação (proposta em slides)', category: 'avaliacao', relatedDiscipline: 'TEC.1632' },
  { date: '2026-10-23', dateLabel: '23/Out', title: 'IVS - Resultado Final', category: 'outro' },
  // Feriados nacionais 2026
  { date: '2026-09-07', dateLabel: '07/Set', title: 'Independência do Brasil', category: 'feriado' },
  { date: '2026-10-12', dateLabel: '12/Out', title: 'Nossa Senhora Aparecida', category: 'feriado' },
  { date: '2026-11-02', dateLabel: '02/Nov', title: 'Finados', category: 'feriado' },
  { date: '2026-11-15', dateLabel: '15/Nov', title: 'Proclamação da República', category: 'feriado' },
  { date: '2026-12-25', dateLabel: '25/Dez', title: 'Natal', category: 'feriado' },
];

export interface StudyStrategy {
  title: string;
  description: string;
  principle: string;
  rules: string[];
}

export const studyStrategy: StudyStrategy = {
  title: 'Estratégia 80/20 com Revisão Espaçada',
  description: 'Foque 80% do tempo nas 3 disciplinas de maior peso (Algoritmos, LM, Matemática), reservando 20% para as demais. Use revisão espaçada (1, 3, 7, 15, 30 dias) para fixar conteúdo.',
  principle: 'Foque no que mais cai em prova e no que é pré-requisito para períodos seguintes.',
  rules: [
    'Algoritmos é a disciplina mais importante do curso - estude TODOS os dias',
    'Linguagem de Marcação tem projeto prático - dedique tempo desde o início',
    'Matemática fornece base para Lógica de Programação - não deixe acumular',
    'Fundamentos da Computação tem 3 avaliações - mantenha conteúdo em dia',
    'RHT e Inglês: revise 2x na semana, basta manter ritmo',
    'Faça revisão espaçada: revise conteúdo após 1 dia, 3 dias, 1 semana, 2 semanas',
    'Use Pomodoro: 25min foco + 5min pausa (4 ciclos) + 15min pausa longa',
    'Resolva exercícios ANTES de ver a resposta - ativa recall',
    'Ensine o que aprendeu (técnica Feynman) - testa entendimento real',
    'Descanse 1 dia na semana para evitar burnout',
  ],
};

export interface EvaluationPeriod {
  disciplineCode: string;
  evaluationName: string;
  description: string;
  /** Semana do calendário que contém a data oficial (informativo, derivado de `date`). */
  estimatedWeek?: number;
  /** Data REAL confirmada (professor/calendário). Obrigatória para exibir prazo na UI. */
  date?: string; // 'YYYY-MM-DD'
  /** Avaliação condicional (ex.: reposição) — não entra no destaque de "próxima avaliação". */
  conditional?: boolean;
}

// POLÍTICA ANTI-ESTIMATIVA: só entram aqui avaliações com DATA OFICIAL confirmada.
// Estimativa engana o aluno — avaliações sem data publicada aparecem como
// "A definir" nos detalhes da disciplina e NUNCA com prazo contado.
export const evaluationPeriods: EvaluationPeriod[] = [
  // Algoritmos — datas REAIS do PDF do professor (30/10, 04/12 e 29/01)
  { disciplineCode: 'TEC.1687', evaluationName: 'Prova 1', description: '1ª avaliação — entrada/saída e desvios condicionais. 3 questões (1 fácil, 1 média, 1 difícil); programas podem vir da Lista de Exercícios (289)', estimatedWeek: 10, date: '2026-10-30' },
  { disciplineCode: 'TEC.1687', evaluationName: 'Prova 2', description: '2ª avaliação — vetores e matrizes', estimatedWeek: 15, date: '2026-12-04' },
  { disciplineCode: 'TEC.1687', evaluationName: 'Prova 3', description: '3ª avaliação — subprogramas e recursividade', estimatedWeek: 19, date: '2027-01-29' },
  { disciplineCode: 'TEC.1687', evaluationName: 'Reposição', description: 'Reposição mediante processo no SUAP', estimatedWeek: 19, date: '2027-02-01', conditional: true },
  // Demais disciplinas — estrutura de avaliação (nomes/pesos reais dos planos docentes)
  // usada APENAS na calculadora de notas; SEM data = sem prazo exibido em lugar nenhum.
  { disciplineCode: 'TEC.1632', evaluationName: 'A1', description: 'Estrutura de um website (HTML) - peso 45%. 1ª etapa (Classroom, 24/09): proposta em slides — entrega 09/10' },
  // Etapa com data oficial publicada no Classroom (prof. Diogo, 24/09) — entra no destaque de prazo.
  { disciplineCode: 'TEC.1632', evaluationName: 'Projeto 1ª etapa', description: 'Proposta do website em slides (~5 min, nomes de todos): nome do site, tema, stakeholders e mínimo 6 tópicos. Entrega no Classroom + apresentação em sala', date: '2026-10-09' },
  { disciplineCode: 'TEC.1632', evaluationName: 'A2', description: 'Codificação visual (CSS) - peso 45%' },
  { disciplineCode: 'TEC.1632', evaluationName: 'A3', description: 'Apresentação do projeto - peso 10%' },
  // Data confirmada pelo dono (19/09): prova de Matemática no dia 01/10.
  // Escopo real confirmado (24/09): Matrizes (até inversa) + Lógica. SEM
  // determinantes e SEM sistemas lineares — o professor ainda não deu.
  { disciplineCode: 'TEC.1984', evaluationName: 'Av1', description: 'Prova — conteúdo dado em sala: Matrizes (operações, transposta, simétrica/antissimétrica, inversa) + Lógica Matemática. NÃO entram: determinantes e sistemas lineares (ainda não dados)', date: '2026-10-01', estimatedWeek: 6 },
  { disciplineCode: 'TEC.1984', evaluationName: 'Av2', description: '2ª avaliação (Lógica Matemática)' },
  { disciplineCode: 'TEC.1984', evaluationName: 'Av3', description: '3ª avaliação (Conjuntos e Funções) + trabalho' },
  { disciplineCode: '53647', evaluationName: 'Av1', description: '1ª avaliação (Histórico, Hardware/Software)' },
  { disciplineCode: '53647', evaluationName: 'Av2', description: '2ª avaliação (Representação de dados, operações binárias)' },
  { disciplineCode: '53647', evaluationName: 'Av3', description: '3ª avaliação (Sistemas e Portas Lógicas)' },
  { disciplineCode: 'TEC.0953', evaluationName: 'Seminário', description: 'Apresentação de seminário' },
  { disciplineCode: 'TEC.0953', evaluationName: 'Atividade escrita', description: 'Atividade avaliativa ESCRITA anunciada pela Profa. Marília — cobre todo o conteúdo dado até hoje. Data oficial (grade do campus): quarta 21/10, 08:40–11:25 (M3–M5), sala S19', date: '2026-10-21' },
  { disciplineCode: 'ING.001', evaluationName: 'N1', description: 'Conjunto de 3 atividades (A1+A2+A3)' },
  { disciplineCode: 'ING.001', evaluationName: 'N2', description: 'Conjunto de 3 atividades (B1+B2+B3)' },
];

// ---------------------------------------------------------------------------
// GRADE OFICIAL DE AULAS — P1 ADS, Turma 2026.2, turno da manhã
// (Task 216, pedido do dono: "você não puxou os horários?").
// Fonte: horarios.ifpb.edu.br/cajazeiras — horário acadêmico 2026.2
// (IFSertãoPB, Campus Cajazeiras), conferido em 14/10/2026. É a resposta
// durável: a casa sabe QUANDO cada aula acontece — e daqui saem a próxima
// aula, o dia certo da RHT (quarta, M3–M5) e a data oficial de avaliações
// anunciadas "para a próxima aula".
export interface WeeklySlotTime {
  slot: string; // 'M1'..'M5'
  start: string; // '07:00'
  end: string; // '07:50'
}

export interface WeeklyClassSlot {
  slot: string;
  label: string; // nome curto exibido na grade
  room: string; // sala oficial (S19, LAB-INF4)
  disciplineCode?: DisciplineCode; // liga com a disciplina da casa
}

export interface WeeklyClassDay {
  dow: number; // 1=Seg..5=Sex (getDay(): 0=Dom..6=Sáb)
  label: string;
  slots: WeeklyClassSlot[];
}

export const weeklySchedule: {
  turma: string;
  turno: string;
  fonte: string;
  conferidaEm: string;
  intervalo: string;
  slotTimes: WeeklySlotTime[];
  dias: WeeklyClassDay[];
} = {
  turma: 'P1 - ADS',
  turno: 'Manhã',
  fonte: 'horarios.ifpb.edu.br/cajazeiras',
  conferidaEm: '2026-10-14',
  intervalo: '09:30–09:45',
  slotTimes: [
    { slot: 'M1', start: '07:00', end: '07:50' },
    { slot: 'M2', start: '07:50', end: '08:40' },
    { slot: 'M3', start: '08:40', end: '09:30' },
    { slot: 'M4', start: '09:45', end: '10:35' },
    { slot: 'M5', start: '10:35', end: '11:25' },
  ],
  dias: [
    {
      dow: 1, label: 'Segunda', slots: [
        { slot: 'M1', label: 'Fund. Comp.', room: 'S19', disciplineCode: '53647' },
        { slot: 'M2', label: 'Fund. Comp.', room: 'S19', disciplineCode: '53647' },
        { slot: 'M3', label: 'Fund. Comp.', room: 'S19', disciplineCode: '53647' },
        { slot: 'M4', label: 'Inglês', room: 'S19', disciplineCode: 'ING.001' },
        { slot: 'M5', label: 'Inglês', room: 'S19', disciplineCode: 'ING.001' },
      ],
    },
    {
      dow: 2, label: 'Terça', slots: [
        { slot: 'M1', label: 'Algoritmos', room: 'S19', disciplineCode: 'TEC.1687' },
        { slot: 'M2', label: 'Algoritmos', room: 'S19', disciplineCode: 'TEC.1687' },
        { slot: 'M3', label: 'Fund. Comp.', room: 'S19', disciplineCode: '53647' },
        { slot: 'M4', label: 'Português', room: 'S19', disciplineCode: 'PORT.001' },
        { slot: 'M5', label: 'Português', room: 'S19', disciplineCode: 'PORT.001' },
      ],
    },
    {
      dow: 3, label: 'Quarta', slots: [
        { slot: 'M1', label: 'Matemática', room: 'S19', disciplineCode: 'TEC.1984' },
        { slot: 'M2', label: 'Matemática', room: 'S19', disciplineCode: 'TEC.1984' },
        { slot: 'M3', label: 'RHT', room: 'S19', disciplineCode: 'TEC.0953' },
        { slot: 'M4', label: 'RHT', room: 'S19', disciplineCode: 'TEC.0953' },
        { slot: 'M5', label: 'RHT', room: 'S19', disciplineCode: 'TEC.0953' },
      ],
    },
    {
      dow: 4, label: 'Quinta', slots: [
        { slot: 'M1', label: 'Linguagens', room: 'LAB-INF4', disciplineCode: 'TEC.1632' },
        { slot: 'M2', label: 'Linguagens', room: 'LAB-INF4', disciplineCode: 'TEC.1632' },
        { slot: 'M3', label: 'Algoritmos', room: 'S19', disciplineCode: 'TEC.1687' },
        { slot: 'M4', label: 'Matemática', room: 'S19', disciplineCode: 'TEC.1984' },
        { slot: 'M5', label: 'Matemática', room: 'S19', disciplineCode: 'TEC.1984' },
      ],
    },
    {
      dow: 5, label: 'Sexta', slots: [
        { slot: 'M1', label: 'Algoritmos', room: 'S19', disciplineCode: 'TEC.1687' },
        { slot: 'M2', label: 'Algoritmos', room: 'S19', disciplineCode: 'TEC.1687' },
        { slot: 'M3', label: 'Algoritmos', room: 'S19', disciplineCode: 'TEC.1687' },
        { slot: 'M4', label: 'Linguagens', room: 'LAB-INF4', disciplineCode: 'TEC.1632' },
        { slot: 'M5', label: 'Linguagens', room: 'LAB-INF4', disciplineCode: 'TEC.1632' },
      ],
    },
  ],
};

/**
 * Horários OFICIAIS de TODOS os slots do campus (2026.2) — manhã, tarde e
 * noite. Fonte única para resolver o início/fim de qualquer slot de qualquer
 * turma (P1 usa M1–M5; P2/P4/P6 usam T; etc.). Task 217.
 */
export const classSlotTimes: WeeklySlotTime[] = [
  { slot: 'M1', start: '07:00', end: '07:50' },
  { slot: 'M2', start: '07:50', end: '08:40' },
  { slot: 'M3', start: '08:40', end: '09:30' },
  { slot: 'M4', start: '09:45', end: '10:35' },
  { slot: 'M5', start: '10:35', end: '11:25' },
  { slot: 'M6', start: '11:25', end: '12:15' },
  { slot: 'T1', start: '13:00', end: '13:50' },
  { slot: 'T2', start: '13:50', end: '14:40' },
  { slot: 'T3', start: '14:40', end: '15:30' },
  { slot: 'T4', start: '15:45', end: '16:35' },
  { slot: 'T5', start: '16:35', end: '17:25' },
  { slot: 'T6', start: '17:25', end: '18:15' },
  { slot: 'N1', start: '18:40', end: '19:30' },
  { slot: 'N2', start: '19:30', end: '20:20' },
  { slot: 'N3', start: '20:35', end: '21:25' },
  { slot: 'N4', start: '21:25', end: '22:15' },
];

/** Horário oficial de um slot — undefined = slot fora da grade (nada inventado). */
export function slotTimeOf(slot: string): WeeklySlotTime | undefined {
  return classSlotTimes.find((s) => s.slot === slot);
}

// ---------------------------------------------------------------------------
// TODOS OS PERÍODOS — as grades P2..P6 (consulta; o dono está no P1).
// Mesma fonte oficial; salas exatamente como publicadas pelo campus.
// ---------------------------------------------------------------------------

export interface WeeklyGrade {
  id: string; // 'P1'..'P6'
  turma: string; // 'P1 - ADS'
  turno: string; // 'Manhã' | 'Tarde'
  turnoCode: 'M' | 'T';
  intervalo: string;
  /** true na turma DO DONO (P1) — fonte de "próxima aula" e dos cronogramas. */
  ativa: boolean;
  dias: WeeklyClassDay[];
}

export const weeklySchedules: WeeklyGrade[] = [
  {
    id: 'P1',
    turma: 'P1 - ADS',
    turno: 'Manhã',
    turnoCode: 'M',
    intervalo: '09:30–09:45',
    ativa: true,
    dias: [
      { dow: 1, label: 'Segunda', slots: weeklySchedule.dias[0].slots },
      { dow: 2, label: 'Terça', slots: weeklySchedule.dias[1].slots },
      { dow: 3, label: 'Quarta', slots: weeklySchedule.dias[2].slots },
      { dow: 4, label: 'Quinta', slots: weeklySchedule.dias[3].slots },
      { dow: 5, label: 'Sexta', slots: weeklySchedule.dias[4].slots },
    ],
  },
  {
    id: 'P2',
    turma: 'P2 - ADS',
    turno: 'Tarde',
    turnoCode: 'T',
    intervalo: '15:30–15:45',
    ativa: false,
    dias: [
      { dow: 1, label: 'Segunda', slots: [
        { slot: 'T1', label: 'Gerência de Config.', room: 'LAB-INF4' },
        { slot: 'T2', label: 'Gerência de Config.', room: 'LAB-INF4' },
        { slot: 'T3', label: 'Estruturas de Dados', room: 'S19' },
        { slot: 'T4', label: 'Estruturas de Dados', room: 'S19' },
        { slot: 'T5', label: 'Estruturas de Dados', room: 'S19' },
      ] },
      { dow: 2, label: 'Terça', slots: [
        { slot: 'T1', label: 'Probabilidade e Estat.', room: 'S19' },
        { slot: 'T2', label: 'Probabilidade e Estat.', room: 'S19' },
        { slot: 'T3', label: 'Inclusão Digital e Social', room: 'S19' },
        { slot: 'T4', label: 'Inclusão Digital e Social', room: 'S19' },
        { slot: 'T5', label: 'Inclusão Digital e Social', room: 'S19' },
      ] },
      { dow: 3, label: 'Quarta', slots: [
        { slot: 'T1', label: 'Probabilidade e Estat.', room: 'S19' },
        { slot: 'T2', label: 'Probabilidade e Estat.', room: 'S19' },
        { slot: 'T3', label: 'Estruturas de Dados', room: 'S19' },
        { slot: 'T4', label: 'Estruturas de Dados', room: 'S19' },
        { slot: 'T5', label: 'Estruturas de Dados', room: 'S19' },
      ] },
      { dow: 4, label: 'Quinta', slots: [
        { slot: 'T1', label: 'Metodologia Científica', room: 'S19' },
        { slot: 'T2', label: 'Metodologia Científica', room: 'S19' },
        { slot: 'T3', label: 'Sistemas Operacionais', room: 'S19' },
        { slot: 'T4', label: 'Sistemas Operacionais', room: 'S19' },
        { slot: 'T5', label: 'Sistemas Operacionais', room: 'S19' },
      ] },
      { dow: 5, label: 'Sexta', slots: [
        { slot: 'T1', label: 'Sistemas Operacionais', room: 'S19' },
        { slot: 'T2', label: 'Linguagens', room: 'LAB-INF4' },
        { slot: 'T3', label: 'Linguagens', room: 'LAB-INF4' },
        { slot: 'T4', label: 'Linguagens', room: 'LAB-INF4' },
        { slot: 'T5', label: 'Linguagens', room: 'LAB-INF4' },
      ] },
    ],
  },
  {
    id: 'P3',
    turma: 'P3 - ADS',
    turno: 'Manhã',
    turnoCode: 'M',
    intervalo: '09:30–09:45',
    ativa: false,
    dias: [
      { dow: 1, label: 'Segunda', slots: [
        { slot: 'M1', label: 'Programação Orientada', room: 'LAB-INF5' },
        { slot: 'M2', label: 'Programação Orientada', room: 'LAB-INF5' },
        { slot: 'M3', label: 'Programação Orientada', room: 'LAB-INF5' },
        { slot: 'M4', label: 'Bancos I', room: 'S03' },
        { slot: 'M5', label: 'Bancos I', room: 'S03' },
      ] },
      { dow: 2, label: 'Terça', slots: [
        { slot: 'M1', label: 'Programação Orientada', room: 'LAB-INF5' },
        { slot: 'M2', label: 'Programação Orientada', room: 'LAB-INF5' },
        { slot: 'M3', label: 'Programação Orientada', room: 'LAB-INF5' },
        { slot: 'M4', label: 'Fund. Engenharia', room: 'LAB-INF6' },
        { slot: 'M5', label: 'Fund. Engenharia', room: 'LAB-INF6' },
      ] },
      { dow: 3, label: 'Quarta', slots: [
        { slot: 'M1', label: 'Relações e Direitos', room: 'S03' },
        { slot: 'M2', label: 'Relações e Direitos', room: 'S03' },
        { slot: 'M3', label: 'Fund. Engenharia', room: 'LAB-INF6' },
        { slot: 'M4', label: 'Fund. Engenharia', room: 'LAB-INF6' },
        { slot: 'M5', label: 'Fund. Engenharia', room: 'LAB-INF6' },
      ] },
      { dow: 4, label: 'Quinta', slots: [
        { slot: 'M1', label: 'Bancos I', room: 'S03' },
        { slot: 'M2', label: 'Bancos I', room: 'S03' },
        { slot: 'M3', label: 'Redes', room: 'LAB-INF6' },
        { slot: 'M4', label: 'Redes', room: 'LAB-INF6' },
        { slot: 'M5', label: 'Redes', room: 'LAB-INF6' },
      ] },
      { dow: 5, label: 'Sexta', slots: [
        { slot: 'M1', label: 'Redes', room: 'LAB-INF6' },
        { slot: 'M2', label: 'Redes', room: 'LAB-INF6' },
        { slot: 'M3', label: 'Redes', room: 'LAB-INF6' },
        { slot: 'M4', label: 'Bancos I', room: 'S03' },
        { slot: 'M5', label: 'Bancos I', room: 'S03' },
      ] },
    ],
  },
  {
    id: 'P4',
    turma: 'P4 - ADS',
    turno: 'Tarde',
    turnoCode: 'T',
    intervalo: '15:30–15:45',
    ativa: false,
    dias: [
      { dow: 1, label: 'Segunda', slots: [
        { slot: 'T1', label: 'Lab. Engenharia', room: 'LAB-INF5' },
        { slot: 'T2', label: 'Lab. Engenharia', room: 'LAB-INF5' },
        { slot: 'T3', label: 'Lab. Engenharia', room: 'LAB-INF5' },
        { slot: 'T4', label: 'Gerência de Projetos', room: 'LAB-INF5' },
        { slot: 'T5', label: 'Gerência de Projetos', room: 'LAB-INF5' },
      ] },
      { dow: 2, label: 'Terça', slots: [
        { slot: 'T1', label: 'Bancos II', room: 'LAB-INF5' },
        { slot: 'T2', label: 'Bancos II', room: 'LAB-INF5' },
        { slot: 'T3', label: 'Bancos II', room: 'LAB-INF5' },
        { slot: 'T4', label: 'Lab. Engenharia', room: 'LAB-INF5' },
        { slot: 'T5', label: 'Lab. Engenharia', room: 'LAB-INF5' },
      ] },
      { dow: 3, label: 'Quarta', slots: [
        { slot: 'T1', label: 'Testes', room: 'LAB-INF5' },
        { slot: 'T2', label: 'Gerência de Projetos', room: 'LAB-INF5' },
        { slot: 'T3', label: 'Gerência de Projetos', room: 'LAB-INF5' },
        { slot: 'T4', label: 'Bancos II', room: 'LAB-INF5' },
        { slot: 'T5', label: 'Bancos II', room: 'LAB-INF5' },
      ] },
      { dow: 4, label: 'Quinta', slots: [
        { slot: 'T1', label: 'Testes', room: 'LAB-INF5' },
        { slot: 'T2', label: 'Testes', room: 'LAB-INF5' },
        { slot: 'T3', label: 'Programação I', room: 'LAB-INF5' },
        { slot: 'T4', label: 'Programação I', room: 'LAB-INF5' },
        { slot: 'T5', label: 'Programação I', room: 'LAB-INF5' },
      ] },
      { dow: 5, label: 'Sexta', slots: [
        { slot: 'T1', label: 'Lab. Redes', room: 'LAB-INF6' },
        { slot: 'T2', label: 'Lab. Redes', room: 'LAB-INF6' },
        { slot: 'T3', label: 'Lab. Redes', room: 'LAB-INF6' },
        { slot: 'T4', label: 'Programação I', room: 'LAB-INF5' },
        { slot: 'T5', label: 'Programação I', room: 'LAB-INF5' },
      ] },
    ],
  },
  {
    id: 'P5',
    turma: 'P5 - ADS',
    turno: 'Manhã',
    turnoCode: 'M',
    intervalo: '09:30–09:45',
    ativa: false,
    dias: [
      { dow: 1, label: 'Segunda', slots: [
        { slot: 'M1', label: 'Práticas I', room: 'S02' },
        { slot: 'M2', label: 'Práticas I', room: 'S02' },
        { slot: 'M3', label: 'Práticas I', room: 'S02' },
        { slot: 'M4', label: 'Empreendedorismo', room: 'S02' },
        { slot: 'M5', label: 'Empreendedorismo', room: 'S02' },
      ] },
      { dow: 2, label: 'Terça', slots: [
        { slot: 'M1', label: 'Programação II', room: 'LAB-INF3' },
        { slot: 'M2', label: 'Programação II', room: 'LAB-INF3' },
        { slot: 'M3', label: 'Práticas I', room: 'S02' },
        { slot: 'M4', label: 'Práticas I', room: 'S02' },
        { slot: 'M5', label: 'Práticas I', room: 'S02' },
      ] },
      { dow: 3, label: 'Quarta', slots: [
        { slot: 'M1', label: 'Arquitetura', room: 'S02 + LAB-INF6' },
        { slot: 'M2', label: 'Arquitetura', room: 'S02 + LAB-INF6' },
        { slot: 'M3', label: 'Empreendedorismo', room: 'S02' },
        { slot: 'M4', label: 'Gestão de Tecnologia', room: 'S02 + LAB-INF5' },
        { slot: 'M5', label: 'Gestão de Tecnologia', room: 'S02 + LAB-INF5' },
      ] },
      { dow: 4, label: 'Quinta', slots: [
        { slot: 'M1', label: 'Segurança', room: 'LAB-INF6' },
        { slot: 'M2', label: 'Segurança', room: 'LAB-INF6' },
        { slot: 'M3', label: 'Programação II', room: 'LAB-INF3' },
        { slot: 'M4', label: 'Programação II', room: 'LAB-INF3' },
        { slot: 'M5', label: 'Programação II', room: 'LAB-INF3' },
      ] },
      { dow: 5, label: 'Sexta', slots: [
        { slot: 'M1', label: 'Arquitetura', room: 'S02 + LAB-INF2' },
        { slot: 'M2', label: 'Arquitetura', room: 'S02 + LAB-INF2' },
        { slot: 'M3', label: 'Arquitetura', room: 'S02 + LAB-INF2' },
        { slot: 'M4', label: 'Segurança', room: 'LAB-INF6' },
        { slot: 'M5', label: 'Segurança', room: 'LAB-INF6' },
      ] },
    ],
  },
  {
    id: 'P6',
    turma: 'P6 - ADS',
    turno: 'Tarde',
    turnoCode: 'T',
    intervalo: '15:30–15:45',
    ativa: false,
    dias: [
      { dow: 1, label: 'Segunda', slots: [
        { slot: 'T1', label: 'Sistemas Distribuídos', room: 'S02 + LAB-INF6' },
        { slot: 'T2', label: 'Sistemas Distribuídos', room: 'S02 + LAB-INF6' },
        { slot: 'T3', label: 'Sistemas Distribuídos', room: 'S02 + LAB-INF6' },
        { slot: 'T4', label: 'Desenvolvimento Web', room: 'S02 + LAB-INF6' },
        { slot: 'T5', label: 'Desenvolvimento Web', room: 'S02 + LAB-INF6' },
      ] },
      { dow: 2, label: 'Terça', slots: [
        { slot: 'T1', label: 'Desenvolvimento Web', room: 'S02 + LAB-INF6' },
        { slot: 'T2', label: 'Desenvolvimento Web', room: 'S02 + LAB-INF6' },
        { slot: 'T3', label: 'Desenvolvimento Web', room: 'S02 + LAB-INF6' },
        { slot: 'T4', label: 'Prog. p/ Dispositivos', room: 'LAB-INF6' },
        { slot: 'T5', label: 'Prog. p/ Dispositivos', room: 'LAB-INF6' },
      ] },
      { dow: 3, label: 'Quarta', slots: [
        { slot: 'T1', label: 'Prog. p/ Dispositivos', room: 'LAB-INF6' },
        { slot: 'T2', label: 'Prog. p/ Dispositivos', room: 'LAB-INF6' },
      ] },
      { dow: 4, label: 'Quinta', slots: [
        { slot: 'T1', label: 'Práticas II', room: 'S02' },
        { slot: 'T2', label: 'Práticas II', room: 'S02' },
        { slot: 'T3', label: 'Práticas II', room: 'S02' },
        { slot: 'T4', label: 'Interação Humano-Comp.', room: 'S02 + LAB-INF6' },
        { slot: 'T5', label: 'Interação Humano-Comp.', room: 'S02 + LAB-INF6' },
      ] },
      { dow: 5, label: 'Sexta', slots: [
        { slot: 'T1', label: 'Interação Humano-Comp.', room: 'S02 + LAB-INF5' },
        { slot: 'T2', label: 'Interação Humano-Comp.', room: 'S02 + LAB-INF5' },
        { slot: 'T3', label: 'Práticas II', room: 'S02' },
        { slot: 'T4', label: 'Práticas II', room: 'S02' },
        { slot: 'T5', label: 'Práticas II', room: 'S02' },
      ] },
    ],
  },
];

export interface NextClassInfo {
  /** Date real da aula (dia + hora de início). */
  at: Date;
  /** 'hoje' | 'amanhã' | dias até a aula (0 = hoje). */
  daysLeft: number;
  dow: number;
  dowLabel: string;
  label: string; // disciplina curta da grade oficial
  room: string;
  slot: WeeklySlotTime;
}

/**
 * A próxima aula da grade oficial a partir de `now` (aula que ainda vai
 * começar — aula em curso não conta). Por padrão usa a turma do dono (P1);
 * para consulta, aceita qualquer grade (ex.: ver a próxima do P3).
 * Pura no `now`, nada lê storage.
 */
export function nextClassFrom(
  now: Date,
  grade: { dias: WeeklyClassDay[] } = weeklySchedule,
): NextClassInfo | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const dia = grade.dias.find((d) => d.dow === day.getDay());
    if (!dia || dia.slots.length === 0) continue;
    for (const s of dia.slots) {
      const t = slotTimeOf(s.slot);
      if (!t) continue;
      const [h, m] = t.start.split(':').map(Number);
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
      if (at.getTime() <= now.getTime()) continue; // já começou/passou
      return {
        at,
        daysLeft: Math.round((at.getTime() - today.getTime()) / 86_400_000),
        dow: dia.dow,
        dowLabel: dia.label,
        label: s.label,
        room: s.room,
        slot: t,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// A INTELIGÊNCIA DA GRADE — o que o site faz com os horários oficiais:
//   · cronogramas de estudo que RESPEITAM a aula (smart-schedule.ts usa
//     classWindowForDay para não marcar estudo em cima do 07:00–11:25);
//   · "quando são as aulas de X" por disciplina (detalhe da disciplina);
//   · aula em curso agora (banner honesto no card da grade).
// ---------------------------------------------------------------------------

/** Janela de aula de um dia da semana (minutos do dia) — null = sem aula. */
export function classWindowForDay(
  dow: number,
  grade: { dias: WeeklyClassDay[] } = weeklySchedule,
): { startMin: number; endMin: number } | null {
  const dia = grade.dias.find((d) => d.dow === dow);
  if (!dia || dia.slots.length === 0) return null;
  const first = slotTimeOf(dia.slots[0].slot);
  const last = slotTimeOf(dia.slots[dia.slots.length - 1].slot);
  if (!first || !last) return null;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return { startMin: toMin(first.start), endMin: toMin(last.end) };
}

/** Aula em curso AGORA (ou a até 15 min de começar) — para avisos honestos. */
export function classHappeningNow(
  now: Date,
  grade: { dias: WeeklyClassDay[] } = weeklySchedule,
): { label: string; room: string; endsAt: string } | null {
  const cw = classWindowForDay(now.getDay(), grade);
  if (!cw) return null;
  const cur = now.getHours() * 60 + now.getMinutes();
  const dia = grade.dias.find((d) => d.dow === now.getDay())!;
  for (const s of dia.slots) {
    const t = slotTimeOf(s.slot);
    if (!t) continue;
    const toMin = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5));
    const start = toMin(t.start);
    const end = toMin(t.end);
    if (cur >= start - 15 && cur < end) {
      return { label: s.label, room: s.room, endsAt: t.end };
    }
  }
  void cw;
  return null;
}

export interface DisciplineClassInfo {
  dowLabel: string;
  start: string;
  end: string;
  room: string;
}

/** "Quando são as aulas de X" na grade ativa — ex.: RHT → Quarta 08:40–11:25 · S19. */
export function classSlotsForDiscipline(
  code: string,
  grade: { dias: WeeklyClassDay[] } = weeklySchedule,
): DisciplineClassInfo[] {
  const out: DisciplineClassInfo[] = [];
  for (const dia of grade.dias) {
    const mine = dia.slots.filter((s) => s.disciplineCode === code);
    if (mine.length === 0) continue;
    const first = slotTimeOf(mine[0].slot);
    const last = slotTimeOf(mine[mine.length - 1].slot);
    if (!first || !last) continue;
    out.push({ dowLabel: dia.label, start: first.start, end: last.end, room: mine[0].room });
  }
  return out;
}

export function getDisciplineByCode(code: string): Discipline | undefined {
  return disciplines.find((d) => d.code === code);
}

export function getMaterialsByDiscipline(code: string): Material[] {
  return materials.filter((m) => m.disciplineCode === code);
}

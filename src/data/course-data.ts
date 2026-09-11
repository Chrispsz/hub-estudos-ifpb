// Dados estruturados do curso - IFPB ADS 2º Semestre 2026.2
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
  materiaisUsuario: number;
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
  type: 'slides' | 'lista_exercicios' | 'web_page' | 'introducao' | 'ementa' | 'video' | 'pdf' | 'calendar';
  // PDF público (servido de /pdfs/) - opcional
  pdfPath?: string;
  // Resumo IA em /data/ai-summaries/
  summaryFile: string;
  pages?: number;
  source: 'user_upload' | 'ifpb_site' | 'pnaat' | 'external';
  externalUrl?: string;
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
  periodo: '2º Semestre',
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
    description: 'Acesso às trilhas do PNAAT (IoT e Edge AI) para concorrer a bolsa',
    category: 'pnaat', icon: 'Cpu' },
  { title: 'Edital IVS 2026.2', url: 'https://www.ifpb.edu.br/campus/cajazeiras/noticias/2026/08/ifpb-campus-cajazeiras-lanca-edital-de-indice-de-vulnerabilidade-social-ivs',
    description: 'Edital 12/2026 - Índice de Vulnerabilidade Social. Inscrições 01/09 a 15/09 pelo SUAP. Auxílio financeiro (R$ 100-300) para estudantes em vulnerabilidade.',
    category: 'institucional', icon: 'HandCoins' },
  { title: 'CAEST - Apoio ao Estudante', url: 'https://ifpb.edu.br/campus/cajazeiras/assuntos/caest',
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
      { name: 'Prova 1', weight: 33.33, scale: 100, description: 'Unidades 1 e 2 - entrada/saída, if/switch' },
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
    materiaisUsuario: 2,
    dicasEstudo: [
      'Pratique TODOS os dias - programação se aprende programando',
      'Faça a Lista de Exercícios completa antes da primeira prova',
      'Compile e execute cada exemplo no computador',
      'Use o depurador (debugger) para entender o fluxo do programa',
      'Quando travar, escreva o algoritmo em português antes de codar',
    ],
    prioridade: 'alta',
    ordemEstudo: [
      '1. Leia o PDF "Introdução" da pasta de materiais',
      '2. Estude Unidade 1 (variáveis, entrada/saída, operadores)',
      '3. Resolva exercícios 1-15 da Lista de Exercícios',
      '4. Estude Unidade 2 (if/switch) - faça exercícios 16-30',
      '5. Pratique cada exemplo no VS Code ou Replit',
      '6. Revise para Prova 1 (30/10 — semana 10)',
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
      { name: 'A1', weight: 45, scale: 100, description: 'Estrutura de um website (HTML)' },
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
    materiaisUsuario: 15,
    dicasEstudo: [
      'Construa um site pessoal desde a primeira semana',
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
      '7. Comece o projeto A1 imediatamente (estrutura HTML)',
      '8. Depois do HTML, estude CSS (seletores, box model)',
      '9. Faça o A2 (CSS) - use Flexbox/Grid',
      '10. Prepare a apresentação A3 com antecedência',
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
    materiaisUsuario: 2,
    dicasEstudo: [
      'Monte tabelas-verdade para TODOS os exercícios de lógica',
      'Pratique conversões e operações com matrizes sem calculadora',
      'Faça mapas mentais conectando Lógica → Conjuntos → Funções',
      'Resolva exercícios extras de Lógica - base para programação',
      'Use a lista de exercícios do professor Eudes como referência',
    ],
    prioridade: 'alta',
    ordemEstudo: [
      '1. Comece pela Álgebra Matricial (Unidade 1)',
      '2. Pratique operações com matrizes e determinantes',
      '3. Estude Lógica - leia os slides "05 - Lógica" (47 páginas)',
      '4. Resolva a Lista de Exercícios de Lógica',
      '5. Monte tabelas-verdade de TODOS os exercícios',
      '6. Estude Conjuntos (Unidade 3)',
      '7. Funções (Unidade 4) - mais longo, reserve tempo',
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
    materiaisUsuario: 0,
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
    materiaisUsuario: 0,
    dicasEstudo: [
      'Participe ativamente dos debates em sala - contam ponto',
      'Faça resumos dos textos indicados antes das aulas',
      'Conecte os conceitos com situações reais do mercado',
      'Prepare o seminário com antecedência (pesquisa + ensaio)',
      'Estude ética - tema transversal em todas as unidades',
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
    materiaisUsuario: 0,
    dicasEstudo: [
      'Leia textos em inglês da área de TI todos os dias (15 min)',
      'Monte um glossário pessoal de termos técnicos',
      'Pratique skimming (ideia geral) e scanning (info específica)',
      'Cuidado com falsos cognatos (ex: actual ≠ atual, pretend ≠ pretender)',
      'Use filmes/séries com legenda em inglês para imersão',
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
    ementa: 'Estudo dirigido da língua portuguesa voltado à produção e compreensão de textos acadêmicos e técnicos. Foco em norma culta, coesão, coerência e produção textual.',
    conteudoProgramatico: [
      { unidade: 'Compreensão e produção textual', topicos: ['Leitura e interpretação de textos',
        'Coesão e coerência textual', 'Produção de textos técnicos'] },
      { unidade: 'Norma culta', topicos: ['Gramática aplicada (concordância, regência, crase)',
        'Vícios de linguagem', 'Semântica e variação linguística'] },
    ],
    objetivos: { geral: 'Desenvolver competências de leitura, interpretação e produção textual em língua portuguesa.',
      especificos: [
        'Aplicar a norma culta em produções textuais',
        'Identificar e corrigir desvios gramaticais',
        'Produzir textos coerentes e coesos',
      ] },
    avaliacao: 'Avaliação contínua com atividades de leitura, interpretação e produção textual.',
    evaluationMethod: 'continua_formativa',
    gradeComponents: [
      { name: 'Atividades', weight: 60, scale: 10, description: 'Atividades de leitura e interpretação' },
      { name: 'Produção Textual', weight: 40, scale: 10, description: 'Produção de textos técnicos' },
    ],
    approvalThreshold: 7,
    finalExamThreshold: 4,
    scale: 10,
    bibliografiaBasica: [
      'BECHARA, E. Moderna Gramática Portuguesa. Nova Fronteira, 37ª ed.',
      'CUNHA, C.; CINTRA, L. Nova Gramática do Português Contemporâneo. Lexikon.',
      'GARCIA, O. M. Comunicação em Prosa Moderna. FGV.',
    ],
    bibliografiaComplementar: [],
    materiaisUsuario: 0,
    dicasEstudo: [
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
    summaryFile: 'mat-logica-slides.summary.json', pages: 47, source: 'user_upload' },
  { id: 'mat-logica-lista', disciplineCode: 'TEC.1984', title: 'Lógica Matemática - Lista de Exercícios',
    type: 'lista_exercicios', pdfPath: '/pdfs/mat-logica-lista.pdf',
    summaryFile: 'mat-logica-lista.summary.json', pages: 2, source: 'user_upload' },
  { id: 'mat-ementa', disciplineCode: 'TEC.1984', title: 'Plano de Disciplina - Matemática',
    type: 'ementa', pdfPath: '/data/ementas/ementa-matematica.pdf',
    summaryFile: 'matematica-ementa.summary.json', source: 'ifpb_site' },
  // Algoritmos
  { id: 'alg-lista', disciplineCode: 'TEC.1687', title: 'Lista de Exercícios de Programação (43 páginas)',
    type: 'lista_exercicios', pdfPath: '/pdfs/alg-lista-exercicios.pdf',
    summaryFile: 'alg-lista.summary.json', pages: 43, source: 'user_upload' },
  { id: 'alg-videoaulas', disciplineCode: 'TEC.1687', title: 'Videoaulas (Google Drive)',
    type: 'video', summaryFile: '', source: 'external',
    externalUrl: 'https://drive.google.com/drive/folders/1QFBEca75o9E-Vd65rDdg2wktqasDzHIx' },
  { id: 'alg-ementa', disciplineCode: 'TEC.1687', title: 'Plano de Disciplina - Algoritmos',
    type: 'ementa', pdfPath: '/data/ementas/ementa-algoritmos.pdf',
    summaryFile: 'algoritmo-ementa.summary.json', source: 'ifpb_site' },
  // Linguagem de Marcação
  { id: 'lm-intro-00', disciplineCode: 'TEC.1632', title: 'Introdução a Linguagens de Marcação',
    type: 'introducao', pdfPath: '/pdfs/lm-00-introducao.pdf',
    summaryFile: 'lm-00-introducao.summary.json', source: 'user_upload' },
  { id: 'lm-01-estrutura', disciplineCode: 'TEC.1632', title: 'HTML - Estrutura básica, elementos, atributos, títulos e parágrafos (32 slides)',
    type: 'slides', pdfPath: '/pdfs/lm-html-01-estrutura.pdf',
    summaryFile: 'lm-html-01-estrutura.summary.json', pages: 32, source: 'user_upload' },
  { id: 'lm-intro-html', disciplineCode: 'TEC.1632', title: 'Introdução a HTML (web)',
    type: 'web_page', pdfPath: '/pdfs/lm-html-introducao.pdf',
    summaryFile: 'lm-html-introducao.summary.json', source: 'user_upload' },
  { id: 'lm-tags', disciplineCode: 'TEC.1632', title: 'Tags e elementos (web)',
    type: 'web_page', pdfPath: '/pdfs/lm-html-tags.pdf',
    summaryFile: 'lm-html-tags.summary.json', source: 'user_upload' },
  { id: 'lm-atributos', disciplineCode: 'TEC.1632', title: 'Atributos e valores (web)',
    type: 'web_page', pdfPath: '/pdfs/lm-html-atributos.pdf',
    summaryFile: 'lm-html-atributos.summary.json', source: 'user_upload' },
  { id: 'lm-titulos', disciplineCode: 'TEC.1632', title: 'Títulos e Parágrafos (web)',
    type: 'web_page', pdfPath: '/pdfs/lm-html-titulos-paragrafos.pdf',
    summaryFile: 'lm-html-titulos.summary.json', source: 'user_upload' },
  { id: 'lm-listas-slides', disciplineCode: 'TEC.1632', title: 'Listas - Slides',
    type: 'slides', pdfPath: '/pdfs/lm-html-02-listas.pdf',
    summaryFile: 'lm-html-02-listas.summary.json', source: 'user_upload' },
  { id: 'lm-listas-web', disciplineCode: 'TEC.1632', title: 'Listas (web)',
    type: 'web_page', pdfPath: '/pdfs/lm-html-listas.pdf',
    summaryFile: 'lm-html-listas.summary.json', source: 'user_upload' },
  // NOVOS MATERIAIS — LM (aulas 03 e 04, enviadas pelo usuário em 11/09)
  { id: 'lm-html-03-hyperlinks', disciplineCode: 'TEC.1632', title: 'HTML - Hyperlinks (16 slides)',
    type: 'slides', pdfPath: '/pdfs/lm-html-03-hyperlinks.pdf',
    summaryFile: 'lm-html-03-hyperlinks.summary.json', pages: 16, source: 'user_upload' },
  { id: 'lm-html-04-midias', disciplineCode: 'TEC.1632', title: 'HTML - Mídias: Imagens, Áudio e Vídeo (17 slides)',
    type: 'slides', pdfPath: '/pdfs/lm-html-04-midias.pdf',
    summaryFile: 'lm-html-04-midias.summary.json', pages: 17, source: 'user_upload' },
  // Apostila digital da disciplina (gitbook do Prof. Diogo) — complemento das aulas
  { id: 'lm-web-hyperlinks', disciplineCode: 'TEC.1632', title: 'Hyperlinks (web — apostila da disciplina)',
    type: 'web_page', summaryFile: '', source: 'external',
    externalUrl: 'https://diogomoreira.gitbook.io/linguagens-de-marcacao/html/hyperlinks' },
  { id: 'lm-web-urls', disciplineCode: 'TEC.1632', title: 'URLs (web — apostila da disciplina)',
    type: 'web_page', summaryFile: '', source: 'external',
    externalUrl: 'https://diogomoreira.gitbook.io/linguagens-de-marcacao/html/urls' },
  { id: 'lm-web-imagens', disciplineCode: 'TEC.1632', title: 'Imagens (web — apostila da disciplina)',
    type: 'web_page', summaryFile: '', source: 'external',
    externalUrl: 'https://diogomoreira.gitbook.io/linguagens-de-marcacao/html/imagens' },
  { id: 'lm-web-audio', disciplineCode: 'TEC.1632', title: 'Áudio (web — apostila da disciplina)',
    type: 'web_page', summaryFile: '', source: 'external',
    externalUrl: 'https://diogomoreira.gitbook.io/linguagens-de-marcacao/html/audio' },
  { id: 'lm-web-video', disciplineCode: 'TEC.1632', title: 'Vídeo (web — apostila da disciplina)',
    type: 'web_page', summaryFile: '', source: 'external',
    externalUrl: 'https://diogomoreira.gitbook.io/linguagens-de-marcacao/html/video' },
  { id: 'lm-ementa', disciplineCode: 'TEC.1632', title: 'Plano de Disciplina - Linguagens de Marcação',
    type: 'ementa', pdfPath: '/data/ementas/ementa-linguagens-marcacao.pdf',
    summaryFile: 'LM-ementa.summary.json', source: 'ifpb_site' },
  // Ementas das outras disciplinas
  { id: 'rht-ementa', disciplineCode: 'TEC.0953', title: 'Plano de Disciplina - RHT',
    type: 'ementa', pdfPath: '/data/ementas/ementa-rht.pdf',
    summaryFile: 'RHT-ementa.summary.json', source: 'ifpb_site' },
  { id: 'fund-ementa', disciplineCode: '53647', title: 'Plano de Disciplina - Fundamentos',
    type: 'ementa', pdfPath: '/data/ementas/ementa-fundamentos.pdf',
    summaryFile: 'fundamentos-ementa.summary.json', source: 'ifpb_site' },
  { id: 'ing-ementa', disciplineCode: 'ING.001', title: 'Plano de Disciplina - Inglês',
    type: 'ementa', pdfPath: '/data/ementas/ementa-ingles.pdf',
    summaryFile: 'ingles-ementa.summary.json', source: 'ifpb_site' },
  // Calendário acadêmico
  { id: 'calendario', disciplineCode: 'PNAAT', title: 'Calendário Acadêmico Semestral 2026',
    type: 'calendar', pdfPath: '/pdfs/calendario-semestral.pdf',
    summaryFile: 'calendario.summary.json', source: 'ifpb_site' },
  // Provas reais (fotos enviadas pelo usuário)
  { id: 'prova-fund-av1', disciplineCode: '53647', title: 'Prova Av1 - Fundamentos da Computação (Prof. André)',
    type: 'pdf', pdfPath: '/pdfs/prova-andre-av1-fundamentos.jpg',
    summaryFile: 'prova-fund-av1.summary.json', source: 'user_upload' },
  { id: 'cronograma-ivs', disciplineCode: 'PNAAT', title: 'Edital IVS - Cronograma (2026.2)',
    type: 'pdf', pdfPath: '/pdfs/cronograma-ivs.jpg',
    summaryFile: '', source: 'user_upload' },
  // PNAAT
  { id: 'pnaat-cursos', disciplineCode: 'PNAAT', title: 'PNAAT - Meus Cursos (PDF)',
    type: 'pdf', pdfPath: '/pdfs/PNAAT-Meus-cursos.pdf',
    summaryFile: '', source: 'pnaat' },
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
    summaryFile: 'mat-00-matrizes.summary.json', source: 'user_upload' },
  { id: 'mat-01-matrizes', disciplineCode: 'TEC.1984', title: 'Matrizes — Aula 01 (Lista)',
    type: 'lista_exercicios', pdfPath: '/pdfs/mat-01-matrizes.pdf',
    summaryFile: 'mat-01-matrizes.summary.json', source: 'user_upload' },
  // NOVOS MATERIAIS — Algoritmos (Slides gerais + Tipos/Operadores)
  { id: 'alg-slides-geral', disciplineCode: 'TEC.1687', title: 'Algoritmos — Slides Gerais (64 páginas, Prof. Fábio)',
    type: 'slides', pdfPath: '/pdfs/alg-slides-geral.pdf',
    summaryFile: 'alg-slides-geral.summary.json', pages: 64, source: 'user_upload' },
  { id: 'alg-tipos-operadores', disciplineCode: 'TEC.1687', title: 'Tipos de Variáveis e Operadores (Prof. Fábio)',
    type: 'slides', pdfPath: '/pdfs/alg-tipos-operadores.pdf',
    summaryFile: 'alg-tipos-operadores.summary.json', pages: 16, source: 'user_upload' },
  // NOVO MATERIAL — Inglês (Vocabulário)
  { id: 'ing-vocabulario', disciplineCode: 'ING.001', title: 'Vocabulário Básico 2026',
    type: 'slides', pdfPath: '/pdfs/ing-vocabulario.pdf',
    summaryFile: 'ing-vocabulario.summary.json', pages: 11, source: 'user_upload' },
];

// PNAAT - Programa Nacional - Programa Nacional de Aprendizagem (FIT Tecnologia)
export interface PnaatModule {
  id: string;
  trail: string;
  title: string;
  durationHours: number;
  professor: string;
  progress: number; // 0-100
  status: 'nao_iniciado' | 'em_andamento' | 'concluido';
}

export interface PnaatTrail {
  id: string;
  title: string;
  totalModules: number;
  modules: PnaatModule[];
}

export const pnaatInfo = {
  nome: 'PNAAT - Programa Nacional de Aprendizagem',
  instituicao: 'FIT Tecnologia',
  tema: 'IoT e Edge AI',
  platformUrl: 'https://fit-tecnologia.org.br/ava/local/customcourses/index.php',
  pdfPath: '/pdfs/PNAAT-Meus-cursos.pdf',
  objetivo: 'Concluir todas as trilhas no prazo para concorrer a bolsa de estudos.',
  usuario: 'Christovão Pereira Silva',
};

export const pnaatTrails: PnaatTrail[] = [
  {
    id: 'fundamentos-iot-edge',
    title: 'Trilha de Fundamentos em IoT e Edge AI',
    totalModules: 5,
    modules: [
      { id: 'pnaat-hub', trail: 'Fundamentos', title: '0. Hub de Aprendizagem PNAAT',
        durationHours: 1, professor: 'Lucas Mattos', progress: 0, status: 'nao_iniciado' },
      { id: 'pnaat-python', trail: 'Fundamentos', title: '1. Fundamentos em Python',
        durationHours: 8, professor: 'Jane Piantoni', progress: 28, status: 'em_andamento' },
      { id: 'pnaat-mod-2', trail: 'Fundamentos', title: '2. (Módulo 2)',
        durationHours: 8, professor: 'A definir', progress: 0, status: 'nao_iniciado' },
      { id: 'pnaat-mod-3', trail: 'Fundamentos', title: '3. (Módulo 3)',
        durationHours: 8, professor: 'A definir', progress: 0, status: 'nao_iniciado' },
      { id: 'pnaat-mod-4', trail: 'Fundamentos', title: '4. (Módulo 4)',
        durationHours: 8, professor: 'A definir', progress: 0, status: 'nao_iniciado' },
    ],
  },
  {
    id: 'eletronica',
    title: 'Trilha de Eletrônica',
    totalModules: 2,
    modules: [
      { id: 'pnaat-ele-1', trail: 'Eletrônica', title: 'Módulo 1 (Eletrônica)',
        durationHours: 6, professor: 'A definir', progress: 0, status: 'nao_iniciado' },
      { id: 'pnaat-ele-2', trail: 'Eletrônica', title: 'Módulo 2 (Eletrônica)',
        durationHours: 6, professor: 'A definir', progress: 0, status: 'nao_iniciado' },
    ],
  },
  {
    id: 'sistemas-embarcados',
    title: 'Trilha de Sistemas Embarcados',
    totalModules: 2,
    modules: [
      { id: 'pnaat-emb-1', trail: 'Sistemas Embarcados', title: 'Módulo 1 (Sistemas Embarcados)',
        durationHours: 6, professor: 'A definir', progress: 0, status: 'nao_iniciado' },
      { id: 'pnaat-emb-2', trail: 'Sistemas Embarcados', title: 'Módulo 2 (Sistemas Embarcados)',
        durationHours: 6, professor: 'A definir', progress: 0, status: 'nao_iniciado' },
    ],
  },
  {
    id: 'edge-ai',
    title: 'Trilha de Edge AI',
    totalModules: 4,
    modules: [
      { id: 'pnaat-ai-1', trail: 'Edge AI', title: 'Módulo 1 (Edge AI)',
        durationHours: 8, professor: 'A definir', progress: 0, status: 'nao_iniciado' },
      { id: 'pnaat-ai-2', trail: 'Edge AI', title: 'Módulo 2 (Edge AI)',
        durationHours: 8, professor: 'A definir', progress: 0, status: 'nao_iniciado' },
      { id: 'pnaat-ai-3', trail: 'Edge AI', title: 'Módulo 3 (Edge AI)',
        durationHours: 8, professor: 'A definir', progress: 0, status: 'nao_iniciado' },
      { id: 'pnaat-ai-4', trail: 'Edge AI', title: 'Módulo 4 (Edge AI)',
        durationHours: 8, professor: 'A definir', progress: 0, status: 'nao_iniciado' },
    ],
  },
  {
    id: 'webinar',
    title: 'Webinar',
    totalModules: 1,
    modules: [
      { id: 'pnaat-webinar', trail: 'Webinar', title: 'Webinar PNAAT',
        durationHours: 2, professor: 'A definir', progress: 0, status: 'nao_iniciado' },
    ],
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
  // 2026.2 - Semestre atual
  { date: '2026-09-01', dateLabel: '01-15/Set', title: 'Edital IVS - Inscrições (SUAP)', category: 'outro' },
  { date: '2026-09-15', dateLabel: '15/Set', title: 'Último dia inscrição IVS', category: 'outro' },
  { date: '2026-09-16', dateLabel: '16/Set-02/Out', title: 'IVS - Análise Socioeconômica', category: 'outro' },
  { date: '2026-10-05', dateLabel: '05-06/Out', title: 'IVS - Entrevistas', category: 'outro' },
  { date: '2026-10-07', dateLabel: '07/Out', title: 'IVS - Resultado Preliminar', category: 'outro' },
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

export interface ScheduleBlock {
  day: number;
  startHour: number;
  startMinute: number;
  durationMin: number;
  disciplineCode: string | 'revisao' | 'descanso' | 'pnaat';
  activity: string;
  title: string;
}

export const recommendedSchedule: ScheduleBlock[] = [
  { day: 1, startHour: 19, startMinute: 0, durationMin: 100, disciplineCode: 'TEC.1687', activity: 'estudo', title: 'Algoritmos - Teoria + Prática' },
  { day: 1, startHour: 20, startMinute: 45, durationMin: 50, disciplineCode: 'TEC.1632', activity: 'estudo', title: 'Linguagem de Marcação - HTML' },
  { day: 2, startHour: 19, startMinute: 0, durationMin: 100, disciplineCode: 'TEC.1984', activity: 'estudo', title: 'Matemática - Lógica e Funções' },
  { day: 2, startHour: 20, startMinute: 45, durationMin: 50, disciplineCode: 'TEC.1687', activity: 'exercicios', title: 'Algoritmos - Lista de Exercícios' },
  { day: 3, startHour: 19, startMinute: 0, durationMin: 100, disciplineCode: 'TEC.1632', activity: 'projeto', title: 'Linguagem de Marcação - Projeto' },
  { day: 3, startHour: 20, startMinute: 45, durationMin: 50, disciplineCode: '53647', activity: 'estudo', title: 'Fundamentos da Computação' },
  { day: 4, startHour: 19, startMinute: 0, durationMin: 75, disciplineCode: 'TEC.1984', activity: 'exercicios', title: 'Matemática - Exercícios' },
  { day: 4, startHour: 20, startMinute: 30, durationMin: 50, disciplineCode: 'ING.001', activity: 'estudo', title: 'Inglês Instrumental - Leitura' },
  { day: 4, startHour: 21, startMinute: 30, durationMin: 30, disciplineCode: 'PORT.001', activity: 'estudo', title: 'Português Instrumental' },
  { day: 5, startHour: 19, startMinute: 0, durationMin: 75, disciplineCode: 'TEC.0953', activity: 'estudo', title: 'RHT - Leitura e Resumos' },
  { day: 5, startHour: 20, startMinute: 30, durationMin: 75, disciplineCode: 'TEC.1687', activity: 'exercicios', title: 'Algoritmos - Revisão de C' },
  { day: 5, startHour: 22, startMinute: 0, durationMin: 30, disciplineCode: 'pnaat', activity: 'estudo', title: 'PNAAT - Trilha IoT' },
  { day: 6, startHour: 9, startMinute: 0, durationMin: 120, disciplineCode: 'revisao', activity: 'revisao', title: 'Revisão Geral da Semana' },
  { day: 6, startHour: 11, startMinute: 30, durationMin: 90, disciplineCode: 'TEC.1632', activity: 'projeto', title: 'Linguagem de Marcação - Projeto Prático' },
  { day: 6, startHour: 14, startMinute: 0, durationMin: 60, disciplineCode: 'TEC.1984', activity: 'exercicios', title: 'Matemática - Lista de Exercícios' },
  { day: 6, startHour: 15, startMinute: 30, durationMin: 60, disciplineCode: 'pnaat', activity: 'estudo', title: 'PNAAT - Módulos da semana' },
];

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
  { disciplineCode: 'TEC.1687', evaluationName: 'Prova 1', description: '1ª avaliação — entrada/saída, if e estruturas de decisão', estimatedWeek: 10, date: '2026-10-30' },
  { disciplineCode: 'TEC.1687', evaluationName: 'Prova 2', description: '2ª avaliação — vetores e matrizes', estimatedWeek: 15, date: '2026-12-04' },
  { disciplineCode: 'TEC.1687', evaluationName: 'Prova 3', description: '3ª avaliação — subprogramas e recursividade', estimatedWeek: 19, date: '2027-01-29' },
  { disciplineCode: 'TEC.1687', evaluationName: 'Reposição', description: 'Reposição mediante processo no SUAP', estimatedWeek: 19, date: '2027-02-01', conditional: true },
  // Demais disciplinas — estrutura de avaliação (nomes/pesos reais dos planos docentes)
  // usada APENAS na calculadora de notas; SEM data = sem prazo exibido em lugar nenhum.
  { disciplineCode: 'TEC.1632', evaluationName: 'A1', description: 'Estrutura de um website (HTML) - peso 45%' },
  { disciplineCode: 'TEC.1632', evaluationName: 'A2', description: 'Codificação visual (CSS) - peso 45%' },
  { disciplineCode: 'TEC.1632', evaluationName: 'A3', description: 'Apresentação do projeto - peso 10%' },
  { disciplineCode: 'TEC.1984', evaluationName: 'Av1', description: '1ª avaliação (Álgebra Matricial)' },
  { disciplineCode: 'TEC.1984', evaluationName: 'Av2', description: '2ª avaliação (Lógica Matemática)' },
  { disciplineCode: 'TEC.1984', evaluationName: 'Av3', description: '3ª avaliação (Conjuntos e Funções) + trabalho' },
  { disciplineCode: '53647', evaluationName: 'Av1', description: '1ª avaliação (Histórico, Hardware/Software)' },
  { disciplineCode: '53647', evaluationName: 'Av2', description: '2ª avaliação (Representação de dados, operações binárias)' },
  { disciplineCode: '53647', evaluationName: 'Av3', description: '3ª avaliação (Sistemas e Portas Lógicas)' },
  { disciplineCode: 'TEC.0953', evaluationName: 'Seminário', description: 'Apresentação de seminário' },
  { disciplineCode: 'ING.001', evaluationName: 'N1', description: 'Conjunto de 3 atividades (A1+A2+A3)' },
  { disciplineCode: 'ING.001', evaluationName: 'N2', description: 'Conjunto de 3 atividades (B1+B2+B3)' },
];

export function getDisciplineByCode(code: string): Discipline | undefined {
  return disciplines.find((d) => d.code === code);
}

export function getMaterialsByDiscipline(code: string): Material[] {
  return materials.filter((m) => m.disciplineCode === code);
}

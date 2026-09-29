// curriculum.ts — GRADE CURRICULAR OFICIAL do curso (fonte única)
//
// Fonte: "Matriz Curricular - 2025" (Fluxograma, Apêndice B do PPC) publicada em
//   https://estudante.ifpb.edu.br/cursos/12/  →  /media/cursos/12/documentos/
//   (IFPB Campus Cajazeiras • Tecnológico em Análise e Desenvolvimento de Sistemas)
// Confrontada com a "Apresentação do curso 2026.1" do Hub: os 7 componentes do
// 1º período batem 100% com as disciplinas reais do dono.
//
// ⚠️ NÃO duplicar estes dados em outros arquivos. Importe daqui.
// Toda menção a "1º Período / Turma 2026.2" no site DEVE vir de CURRENT_PERIOD_LABEL.
//
// TERMINOLOGIA (correção do dono, 26/09): "2026.2" é a TURMA de ingresso — a SEGUNDA
// das duas turmas que o curso recebe por ano — e NÃO um período/semestre do curso.
// O dono está no 1º PERÍODO da turma 2026.2. Nunca rotular 2026.2 como "período".

/** Núcleos da matriz oficial (legenda do fluxograma). */
export type CurriculumNucleus =
  | 'Programação'
  | 'Programação para Internet'
  | 'Formação Geral'
  | 'Engenharia de Software'
  | 'Banco de Dados'
  | 'Redes de Computadores'
  | 'Extensão'
  | 'Optativa';

/** Classe Tailwind do ponto colorido de cada núcleo (legenda + grade) — FONTE ÚNICA. */
export const NUCLEUS_DOT_BG: Record<CurriculumNucleus, string> = {
  Programação: 'bg-emerald-500',
  'Programação para Internet': 'bg-teal-500',
  'Formação Geral': 'bg-amber-400',
  'Engenharia de Software': 'bg-rose-400',
  'Banco de Dados': 'bg-violet-400',
  'Redes de Computadores': 'bg-purple-400',
  Extensão: 'bg-slate-400',
  Optativa: 'bg-orange-400',
};

/** Todos os núcleos distintos que aparecem na matriz (ordem de 1ª aparição — p/ legenda). */
export function nucleiInMatrix(): CurriculumNucleus[] {
  const out: CurriculumNucleus[] = [];
  for (const d of ADS_CURRICULUM.flatMap((p) => p.disciplines)) {
    if (!out.includes(d.nucleus)) out.push(d.nucleus);
  }
  return out;
}

export interface CurriculumDiscipline {
  /** Número N da disciplina na matriz oficial (11, 12… 66). */
  code: number;
  name: string;
  shortName: string;
  /** Carga horária total da disciplina (horas-relógio). */
  ch: number;
  /** Aulas semanais (A/S do fluxograma). */
  aulasSemanais: number;
  nucleus: CurriculumNucleus;
  /** Pré-requisitos oficiais (números N da matriz), quando existem. */
  prereqs?: number[];
  /** Docente da linha na página oficial do curso (Disciplinas e Corpo Docente). */
  docente?: string;
  /** Titulação do docente, quando informada no portal (Doutorado/Mestrado). */
  titulacao?: string;
  /**
   * `code` da disciplina ATIVA correspondente no Hub (course-data.ts).
   * Presente só nas disciplinas do período atual — garantia de que o conteúdo
   * do Hub está amarrado 1:1 com a matriz oficial.
   */
  hubCode?: string;
}

export interface CurriculumPeriod {
  /** Nº do período no curso (1–6). */
  period: number;
  label: string;
  /** CH semestral da matriz (416/417 h). */
  ch: number;
  disciplines: CurriculumDiscipline[];
}

/** Informações institucionais do curso (fonte: página oficial do curso). */
export const COURSE_INFO = {
  name: 'Análise e Desenvolvimento de Sistemas',
  level: 'Superior — Tecnológico',
  campus: 'IFPB Campus Cajazeiras',
  modalidade: 'Presencial',
  turno: 'Integral',
  chTotal: 2500,
  chOptativa: 50,
  periodsCount: 6,
  /** O curso recebe DUAS turmas ingressantes por ano (ex.: 2026.1 e 2026.2). */
  turmasPorAno: 2,
  /** Coordenação do curso — página oficial (Contatos → Coordenação). */
  coordenacao: {
    coordenador: 'Fabio Abrantes Diniz',
    substituto: 'Diogo Dantas Moreira',
    email: 'cads.cz@ifpb.edu.br',
    telefone: '(83) 3532-4100',
  },
  /** Formas de acesso oficiais ao curso. */
  formasAcesso: ['PSCS', 'PSE', 'SiSU (ENEM)'],
  /** Perfil do egresso (resumo do portal, 1 frase). */
  perfil:
    'O tecnólogo analisa, projeta, documenta, especifica, testa, implanta e mantém sistemas computacionais de informação, com raciocínio lógico, linguagens de programação e preocupação com qualidade, usabilidade, robustez, integridade e segurança.',
  url: 'https://estudante.ifpb.edu.br/cursos/12/',
  /** Fontes oficiais consultadas (para honestidade/auditoria). */
  fontes: [
    'Matriz Curricular — Fluxograma (Apêndice B do PPC) — estudante.ifpb.edu.br/cursos/12',
    'Disciplinas e Corpo Docente + Coordenação — página oficial do curso (consultada em 26/09/2026)',
    'Apresentação do curso 2026.1 (professores do 1º período) — Biblioteca do Hub',
  ],
} as const;

/** Período atual do dono do Hub. Trocar para 2 quando a turma 2026.2 avançar (2027.2). */
export const CURRENT_PERIOD = 1;
/**
 * TURMA de ingresso do dono do Hub — 2026.2 = SEGUNDA turma ingressante do ano
 * (o curso recebe duas turmas por ano: 2026.1 e 2026.2). NÃO é um período:
 * nunca rotular "2026.2" como período/semestre do curso.
 */
export const CURRENT_TURMA_LABEL = '2026.2';

/** Rótulo composto usado em header, metadados e prompts do tutor. */
export const CURRENT_PERIOD_LABEL = `${CURRENT_PERIOD}º Período • Turma ${CURRENT_TURMA_LABEL}`;
/** Versão minúscula para meio de frase ("…do 1º período de ADS…"). */
export const CURRENT_PERIOD_LOWER = `${CURRENT_PERIOD}º período de ADS`;
/** Rótulo da turma para exibição ("turma 2026.2"). */
export const CURRENT_TURMA_LOWER = `turma ${CURRENT_TURMA_LABEL}`;

const P1: CurriculumDiscipline[] = [
  { code: 11, name: 'Matemática Aplicada à Computação', shortName: 'Matemática', ch: 67, aulasSemanais: 4, nucleus: 'Formação Geral', hubCode: 'TEC.1984', docente: 'Antonio Eudes Ferreira' },
  { code: 12, name: 'Inglês Instrumental', shortName: 'Inglês', ch: 33, aulasSemanais: 2, nucleus: 'Formação Geral', hubCode: 'ING.001', docente: 'Daniela Miguel de Souza Morais', titulacao: 'Mestrado' },
  { code: 13, name: 'Português Instrumental', shortName: 'Português', ch: 33, aulasSemanais: 2, nucleus: 'Formação Geral', hubCode: 'PORT.001', docente: 'Francisco Igor Arraes Alves Rocha', titulacao: 'Mestrado' },
  { code: 14, name: 'Algoritmos e Lógica de Programação', shortName: 'Algoritmos', ch: 100, aulasSemanais: 6, nucleus: 'Programação', hubCode: 'TEC.1687', docente: 'Fabio Gomes de Andrade', titulacao: 'Doutorado' },
  { code: 15, name: 'Fundamentos da Computação', shortName: 'Fundamentos', ch: 67, aulasSemanais: 4, nucleus: 'Programação', hubCode: '53647', docente: 'André Lira Rolim' },
  { code: 16, name: 'Linguagens de Marcação', shortName: 'Linguagens de Marcação', ch: 67, aulasSemanais: 4, nucleus: 'Programação para Internet', hubCode: 'TEC.1632', docente: 'Diogo Dantas Moreira', titulacao: 'Mestrado' },
  { code: 17, name: 'Relações Humanas no Trabalho', shortName: 'RHT', ch: 50, aulasSemanais: 3, nucleus: 'Formação Geral', hubCode: 'TEC.0953', docente: 'Marília Aguiar Ribeiro do Nascimento', titulacao: 'Mestrado' },
];

const P2: CurriculumDiscipline[] = [
  { code: 21, name: 'Linguagens de Script para a Web', shortName: 'Script para Web', ch: 67, aulasSemanais: 4, nucleus: 'Programação para Internet', prereqs: [16], docente: 'Fabio Abrantes Diniz', titulacao: 'Mestrado' },
  { code: 22, name: 'Estruturas de Dados', shortName: 'Estruturas de Dados', ch: 100, aulasSemanais: 6, nucleus: 'Programação', prereqs: [14], docente: 'André Lira Rolim' },
  { code: 23, name: 'Sistemas Operacionais', shortName: 'Sistemas Operacionais', ch: 67, aulasSemanais: 4, nucleus: 'Banco de Dados', prereqs: [15], docente: 'João Igor Barros Rocha' },
  { code: 24, name: 'Probabilidade e Estatística Aplicada à Computação', shortName: 'Probabilidade', ch: 67, aulasSemanais: 4, nucleus: 'Formação Geral', docente: 'Vinicius Martins Teodosio Rocha', titulacao: 'Doutorado' },
  { code: 25, name: 'Gerência de Configuração e Mudanças', shortName: 'Gerência Config.', ch: 33, aulasSemanais: 2, nucleus: 'Engenharia de Software', docente: 'Francisco Paulo de Freitas Neto', titulacao: 'Mestrado' },
  { code: 26, name: 'Metodologia da Pesquisa Científica', shortName: 'Metodologia', ch: 33, aulasSemanais: 2, nucleus: 'Formação Geral', docente: 'Vanessa Belmiro dos Santos Meira', titulacao: 'Doutorado' },
  { code: 27, name: 'Inclusão Tecnológica', shortName: 'Inclusão Tecnológica', ch: 50, aulasSemanais: 3, nucleus: 'Extensão', docente: 'Eva Maria Campos Pereira', titulacao: 'Doutorado' },
];

const P3: CurriculumDiscipline[] = [
  { code: 31, name: 'Programação Orientada a Objetos', shortName: 'POO', ch: 100, aulasSemanais: 6, nucleus: 'Programação', prereqs: [14], docente: 'Francisco Paulo de Freitas Neto', titulacao: 'Mestrado' },
  { code: 32, name: 'Bancos de Dados I', shortName: 'Bancos de Dados I', ch: 100, aulasSemanais: 6, nucleus: 'Banco de Dados', docente: 'Fabio Gomes de Andrade', titulacao: 'Doutorado' },
  { code: 33, name: 'Relações Étnico-Raciais e Direitos Humanos', shortName: 'Étnico-Raciais', ch: 33, aulasSemanais: 2, nucleus: 'Formação Geral', docente: 'Marília Aguiar Ribeiro do Nascimento', titulacao: 'Mestrado' },
  { code: 34, name: 'Redes de Computadores', shortName: 'Redes', ch: 100, aulasSemanais: 6, nucleus: 'Redes de Computadores', docente: 'Francisco Daladier Marques Junior', titulacao: 'Doutorado' },
  { code: 35, name: 'Fundamentos de Engenharia de Software', shortName: 'Fund. Eng. Software', ch: 83, aulasSemanais: 5, nucleus: 'Engenharia de Software', docente: 'Janderson Ferreira Dutra', titulacao: 'Mestrado' },
];

const P4: CurriculumDiscipline[] = [
  { code: 41, name: 'Programação para a Web I', shortName: 'Web I', ch: 83, aulasSemanais: 5, nucleus: 'Programação para Internet', prereqs: [21], docente: 'Fabio Abrantes Diniz', titulacao: 'Mestrado' },
  { code: 42, name: 'Gerência de Projetos de Software', shortName: 'Gerência Projetos', ch: 67, aulasSemanais: 4, nucleus: 'Engenharia de Software', docente: 'Eva Maria Campos Pereira', titulacao: 'Doutorado' },
  { code: 43, name: 'Laboratório de Engenharia de Software', shortName: 'Lab. Eng. Software', ch: 83, aulasSemanais: 5, nucleus: 'Engenharia de Software', prereqs: [31, 35], docente: 'Janderson Ferreira Dutra', titulacao: 'Mestrado' },
  { code: 44, name: 'Laboratório de Redes de Computadores', shortName: 'Lab. Redes', ch: 50, aulasSemanais: 3, nucleus: 'Redes de Computadores', prereqs: [34], docente: 'Francisco Daladier Marques Junior', titulacao: 'Doutorado' },
  { code: 45, name: 'Bancos de Dados II', shortName: 'Bancos de Dados II', ch: 83, aulasSemanais: 5, nucleus: 'Banco de Dados', prereqs: [31, 32], docente: 'Francisco Paulo de Freitas Neto', titulacao: 'Mestrado' },
  { code: 46, name: 'Testes de Software', shortName: 'Testes', ch: 50, aulasSemanais: 3, nucleus: 'Engenharia de Software', docente: 'João Igor Barros Rocha' },
];

const P5: CurriculumDiscipline[] = [
  { code: 51, name: 'Programação para a Web II', shortName: 'Web II', ch: 83, aulasSemanais: 5, nucleus: 'Programação para Internet', prereqs: [41], docente: 'Diogo Dantas Moreira', titulacao: 'Mestrado' },
  { code: 52, name: 'Arquitetura e Padrões Projetos de Software', shortName: 'Arquitetura', ch: 83, aulasSemanais: 5, nucleus: 'Engenharia de Software', prereqs: [43], docente: 'Diogo Dantas Moreira', titulacao: 'Mestrado' },
  { code: 53, name: 'Segurança de Dados', shortName: 'Segurança', ch: 67, aulasSemanais: 4, nucleus: 'Redes de Computadores', prereqs: [44], docente: 'Francisco Daladier Marques Junior', titulacao: 'Doutorado' },
  { code: 54, name: 'Gestão de Tecnologia da Informação e Comunicação', shortName: 'Gestão TIC', ch: 33, aulasSemanais: 2, nucleus: 'Engenharia de Software', docente: 'João Igor Barros Rocha' },
  { code: 55, name: 'Empreendedorismo', shortName: 'Empreendedorismo', ch: 50, aulasSemanais: 3, nucleus: 'Formação Geral', docente: 'Alec van de Franca Sousa', titulacao: 'Mestrado' },
  { code: 56, name: 'Práticas Curriculares em Sociedade I', shortName: 'Práticas I', ch: 100, aulasSemanais: 6, nucleus: 'Extensão', docente: 'Fabio Gomes de Andrade' },
];

const P6: CurriculumDiscipline[] = [
  { code: 61, name: 'Sistemas Distribuídos', shortName: 'Sist. Distribuídos', ch: 50, aulasSemanais: 3, nucleus: 'Programação', prereqs: [44], docente: 'Cicero Aristofanio Garcia de Araujo', titulacao: 'Mestrado' },
  { code: 62, name: 'Desenvolvimento de Aplicações Corporativas', shortName: 'Aplic. Corporativas', ch: 83, aulasSemanais: 5, nucleus: 'Programação para Internet', prereqs: [41], docente: 'Cicero Aristofanio Garcia de Araujo', titulacao: 'Mestrado' },
  { code: 63, name: 'Interação Humano-Computador', shortName: 'IHC', ch: 67, aulasSemanais: 4, nucleus: 'Engenharia de Software', docente: 'Afonso Serafim Jacinto', titulacao: 'Mestrado' },
  { code: 64, name: 'Programação para Dispositivos Móveis', shortName: 'Apps Móveis', ch: 67, aulasSemanais: 4, nucleus: 'Programação para Internet', docente: 'Fabio Abrantes Diniz', titulacao: 'Mestrado' },
  { code: 65, name: 'Optativa', shortName: 'Optativa', ch: 50, aulasSemanais: 3, nucleus: 'Optativa', docente: 'Ramon da Silva Santana', titulacao: 'Mestrado' },
  { code: 66, name: 'Práticas Curriculares em Sociedade II', shortName: 'Práticas II', ch: 100, aulasSemanais: 6, nucleus: 'Extensão', docente: 'Janderson Ferreira Dutra', titulacao: 'Mestrado' },
];

/** Grade completa — 6 períodos, 37 componentes (7+7+5+6+6+6), 2500h. */
export const ADS_CURRICULUM: CurriculumPeriod[] = [
  { period: 1, label: '1º período', ch: 417, disciplines: P1 },
  { period: 2, label: '2º período', ch: 417, disciplines: P2 },
  { period: 3, label: '3º período', ch: 416, disciplines: P3 },
  { period: 4, label: '4º período', ch: 416, disciplines: P4 },
  { period: 5, label: '5º período', ch: 416, disciplines: P5 },
  { period: 6, label: '6º período', ch: 417, disciplines: P6 },
];

/** Total de disciplinas da matriz (36) — derivado, nunca hard-coded. */
export const CURRICULUM_DISCIPLINES_COUNT = ADS_CURRICULUM.reduce(
  (acc, p) => acc + p.disciplines.length,
  0,
);

/** CH somada da matriz (2000 h obrigatórias + optativa 50 h ≈ fluxograma). */
export const CURRICULUM_CH_TOTAL = ADS_CURRICULUM.reduce(
  (acc, p) => acc + p.disciplines.reduce((a, d) => a + d.ch, 0),
  0,
);

/** Dados do período atual (com as disciplinas do Hub amarradas por hubCode). */
export function getCurrentPeriod(): CurriculumPeriod {
  const p = ADS_CURRICULUM.find((x) => x.period === CURRENT_PERIOD);
  if (!p) throw new Error(`Período atual ${CURRENT_PERIOD} não existe na matriz`);
  return p;
}

/** Período do curso em que uma disciplina do Hub está — 100% derivado da matriz. */
export function getCoursePeriodOf(hubCode: string): number | undefined {
  for (const p of ADS_CURRICULUM) {
    if (p.disciplines.some((d) => d.hubCode === hubCode)) return p.period;
  }
  return undefined;
}

/** Linha da matriz correspondente a uma disciplina do Hub (por hubCode). */
export function getCurriculumRow(hubCode: string): CurriculumDiscipline | undefined {
  return ADS_CURRICULUM.flatMap((p) => p.disciplines).find((d) => d.hubCode === hubCode);
}

/** Disciplina da matriz pelo código numérico N (11–66). */
export function getMatrixDiscipline(code: number): CurriculumDiscipline | undefined {
  return ADS_CURRICULUM.flatMap((p) => p.disciplines).find((d) => d.code === code);
}

/** Linha da matriz + o período completo (rótulo, nº) de uma disciplina do Hub. */
export interface CurriculumRowInfo {
  row: CurriculumDiscipline;
  period: CurriculumPeriod;
}

export function getCurriculumInfo(hubCode: string): CurriculumRowInfo | undefined {
  for (const p of ADS_CURRICULUM) {
    const row = p.disciplines.find((d) => d.hubCode === hubCode);
    if (row) return { row, period: p };
  }
  return undefined;
}

/** shortName dos pré-requisitos de uma linha da matriz (nomes legíveis). */
export function prereqShortNames(d: CurriculumDiscipline): string[] {
  return (d.prereqs ?? []).map(
    (n) => getMatrixDiscipline(n)?.shortName ?? String(n),
  );
}

/** Frase de contexto institucional para o system prompt do tutor. */
export function tutorCourseContext(): string {
  const p = getCurrentPeriod();
  const nomes = p.disciplines
    .map((d) => `${d.name}${d.docente ? ` — prof. ${d.docente}` : ''}`)
    .join(', ');
  return (
    `O aluno está no ${p.label} do curso ${COURSE_INFO.name} (${COURSE_INFO.level}, ` +
    `${COURSE_INFO.campus}). IMPORTANTE sobre terminologia: "${CURRENT_TURMA_LABEL}" é a ` +
    `TURMA de ingresso dele — a segunda das ${COURSE_INFO.turmasPorAno} turmas que ingressam ` +
    `no curso por ano — e NÃO um período do curso; o período atual dele é o ${CURRENT_PERIOD}º. ` +
    `Disciplinas dele (com docentes do portal oficial): ${nomes}. ` +
    `Coordenação do curso: ${COURSE_INFO.coordenacao.coordenador} (${COURSE_INFO.coordenacao.email}). ` +
    `A grade completa tem ${COURSE_INFO.periodsCount} períodos e ${COURSE_INFO.chTotal}h — ` +
    `responda sempre dentro do vocabulário e do nível de um aluno desse estágio.`
  );
}

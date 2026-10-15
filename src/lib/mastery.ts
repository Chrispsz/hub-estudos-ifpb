// mastery.ts — A PROVA DE APRENDIZAGEM (Task 220, pergunta do dono 15/10/2026:
// "o que acontece quando marco um conteúdo como concluído? E como vou ter
// CERTEZA de que aprendi?").
//
// A resposta honesta da casa: MARCAR é o seu aviso, não a prova. O check do
// tópico ("eu estudei isto") e o "concluído" do material são auto-relato —
// a casa os aceita e os usa (a escada, a fila e o cronograma reagem na hora),
// mas a CERTEZA vem de evidência que o próprio estudo registra:
//   · abrir/concluir material da unidade → registro de estudo real;
//   · tentar questão da unidade → prática real;
//   · RESOLVER sem ajuda → a prova do recall ativo (Agarwal: testar fixa
//     mais que reler — o mesmo princípio da página em branco).
//
// A escada de maestria por UNIDADE (três estados + o vazio):
//   · marcado      — check completo, zero registro de estudo (o estado que
//                    merece alerta: virou intenção, ainda não virou fato);
//   · praticado    — há registro real (material concluído ou questão
//                    tentada), mas a prova do recall ainda não fechou;
//   · consolidado  — ≥2 questões resolvidas SEM ajuda e ≥60% de acerto no
//                    que tentou: aprendizado DEMONSTRADO, não declarado.
//                   (Piso de 2: um único acerto é sorte, não prova.)
//   · sem-registro — nada marcado e nada feito (estado mudo: sem julgamento).
//
// Fonte única da evidência: discipline-activity.ts (o mesmo motor que conta
// "materiais vistos / questões tentadas" na unidade — zero segunda derivação;
// a nova contagem `questoesResolvidasSemAjuda` mora lá). Lib PURA: nada lê
// storage, o chamador injeta o progresso.

import { disciplines } from '@/data/course-data';
import { unitActivityFor, type UnitActivity } from './discipline-activity';
import { unidadeCurta } from './content-strategy';
import type { StudyProgress } from './study-progress';

export type MasteryLevel = 'marcado' | 'praticado' | 'consolidado' | 'sem-registro';

export interface UnitMastery {
  level: MasteryLevel;
  /** Todos os tópicos da unidade marcados manualmente (o auto-relato). */
  checked: boolean;
  /** Questões da unidade tentadas (tried ou solved) — prática real. */
  tentadas: number;
  /** Resolvidas SEM ajuda — a prova do recall. */
  resolvidasSemAjuda: number;
  /** Total de questões em sala para a unidade (0 = acervo sem questões ali). */
  questoesTotal: number;
  /** Materiais da unidade concluídos. */
  concluidos: number;
  /** O veredito honesto em uma frase — a voz do selo. */
  frase: string;
}

/** Piso da prova: 1 acerto é sorte; a partir de 2 com boa taxa, é demonstração. */
const PISO_CONSOLIDADO = 2;
/** Taxa de acerto mínima sobre o que tentou (sem ajuda) para consolidar. */
const TAXA_CONSOLIDADO = 0.6;

/**
 * A maestria lida da ATIVIDADE REAL — o chamador que já tem o `UnitActivity`
 * em mãos (ex.: study-view memoizando `unitActivityFor` por unidade) injeta
 * aqui; `unitMasteryFor` é o atalho que calcula a atividade por dentro.
 */
export function masteryFromActivity(
  act: UnitActivity | null | undefined,
  checked: boolean,
): UnitMastery {
  const tentadas = act?.questoesTentadas ?? 0;
  const resolvidas = act?.questoesResolvidasSemAjuda ?? 0;
  const questoesTotal = act?.questoesTotal ?? 0;
  const concluidos = act?.materiaisConcluidos ?? 0;

  const consolidado =
    resolvidas >= PISO_CONSOLIDADO &&
    resolvidas >= TAXA_CONSOLIDADO * Math.max(1, tentadas);

  if (consolidado) {
    const taxa = Math.round((resolvidas / Math.max(1, tentadas)) * 100);
    return {
      level: 'consolidado',
      checked,
      tentadas,
      resolvidasSemAjuda: resolvidas,
      questoesTotal,
      concluidos,
      frase: `prova registrada: ${resolvidas} questão(ões) resolvida(s) sem ajuda (${taxa}% do que tentou) — aprendizado demonstrado; a revisão espaçada mantém`,
    };
  }

  if (tentadas > 0) {
    const faltam = Math.max(0, PISO_CONSOLIDADO - resolvidas);
    return {
      level: 'praticado',
      checked,
      tentadas,
      resolvidasSemAjuda: resolvidas,
      questoesTotal,
      concluidos,
      frase:
        resolvidas > 0
          ? `prática registrada (${resolvidas} sem ajuda de ${tentadas} tentada(s)) — vira consolidado com mais ${faltam} acerto(s) de cabeça`
          : `prática registrada (${tentadas} tentada(s), nenhuma sem ajuda) — a prova final é resolver de cabeça, sem consulta`,
    };
  }

  if (concluidos > 0) {
    return {
      level: 'praticado',
      checked,
      tentadas,
      resolvidasSemAjuda: resolvidas,
      questoesTotal,
      concluidos,
      frase: `material concluído registrado — estudar de verdade é o primeiro degrau; a prova final é resolver questões da unidade sem ajuda`,
    };
  }

  if (checked) {
    return {
      level: 'marcado',
      checked,
      tentadas,
      resolvidasSemAjuda: resolvidas,
      questoesTotal,
      concluidos,
      frase:
        questoesTotal > 0
          ? `marcou como estudado, mas nada registra a prática — o check é o seu aviso; a prova é resolver (${questoesTotal} questão(ões) da unidade esperam)`
          : `marcou como estudado, mas nada registra a prática — sem questões no acervo para esta unidade, crie um programa/aplicação do conteúdo e o tutor avalia`,
    };
  }

  return {
    level: 'sem-registro',
    checked: false,
    tentadas,
    resolvidasSemAjuda: resolvidas,
    questoesTotal,
    concluidos,
    frase: '',
  };
}

/**
 * A maestria de UMA unidade (nome exato do conteudoProgramatico) lida do
 * progresso — o atalho para quem só tem (código, unidade, progresso).
 */
export function unitMasteryFor(
  code: string,
  unitName: string,
  progress: StudyProgress,
): UnitMastery {
  const d = disciplines.find((x) => x.code === code);
  const unitDef = d?.conteudoProgramatico.find((u) => u.unidade === unitName);
  const manualTotal = unitDef?.topicos.length ?? 0;
  const manualDone = unitDef
    ? unitDef.topicos.filter((t) => progress.topicProgress?.[code]?.[t]).length
    : 0;
  const checked = manualTotal > 0 && manualDone >= manualTotal;
  const act = unitActivityFor(code, unitName, progress, manualDone, manualTotal);
  return masteryFromActivity(act, checked);
}

// ---------- Apresentação ----------

export type MasteryTone = 'emerald' | 'violet' | 'amber';

/** Selo honesto da unidade — o tom manda nas classes e no ícone do chamador. */
export function masteryBadgeFor(m: UnitMastery): {
  tone: MasteryTone;
  label: string;
  title: string;
} | null {
  switch (m.level) {
    case 'consolidado':
      return {
        tone: 'emerald',
        label: 'consolidado',
        title: `${m.frase} · marcar concluído nunca foi a prova — resolver foi.`,
      };
    case 'praticado':
      return {
        tone: 'violet',
        label: 'praticado',
        title: `${m.frase} · a casa registrou o que você fez.`,
      };
    case 'marcado':
      return {
        tone: 'amber',
        label: 'só marcado',
        title: `${m.frase} · "como vou ter certeza de que aprendi?" — a resposta é esta unidade gerar evidência.`,
      };
    default:
      return null; // sem-registro é mudo — sem julgamento, sem ruído
  }
}

// ---------- O aviso na escada (a fila essencial + o tutor) ----------

/** Só os campos da EscadaPosicao que o aviso lê (tipagem estrutural — zero acoplamento). */
export interface DegrauRef {
  unidadeAtual: string;
  unidadeIdx: number;
  topicosFeitos: number;
}

/**
 * O AVISO DA PROVA NO DEGRAU (Task 220) — onde o "só marquei" aparece na
 * fila essencial. Descoberta estrutural (a mesma da lacuna impossível):
 * a escada NUNCA aponta para uma unidade toda marcada — quem marca tudo
 * sobe de degrau. Então o check sem prova se manifesta de dois jeitos
 * REAIS, e é neles que a casa acusa:
 *   1. o degrau DE TRÁS foi fechado no check e nada registra prática
 *      (o caso mais comum e mais perigoso: a base "concluída" é oca —
 *      se o degrau atual travar, o método nela é a prova);
 *   2. o degrau ATUAL tem tópicos marcados (leitura acompanhando a aula)
 *      mas zero evidência de prática — o check virou anotação.
 * null = nada a acusar (degrau de trás com prova, ou primeiro degrau).
 */
export function degrauProvaAviso(
  code: string,
  pos: DegrauRef,
  progress: StudyProgress,
  metodoNome: string,
): string | null {
  // O nome do método vem com tagline ("PRIMM — código pronto antes do seu"):
  // na frase do aviso cabe só a assinatura ("PRIMM"). Derivação ÚNICA aqui —
  // fila essencial e tutor recebem a frase já limpa.
  const nomeCurto = metodoNome.split(' — ')[0]?.trim() || metodoNome;
  const units = disciplines.find((x) => x.code === code)?.conteudoProgramatico ?? [];

  // 1) O degrau de trás fechado só no check — a base oca.
  if (pos.unidadeIdx >= 2) {
    const prev = units[pos.unidadeIdx - 2];
    if (prev) {
      const masPrev = unitMasteryFor(code, prev.unidade, progress);
      if (masPrev.level === 'marcado') {
        return `“${unidadeCurta(prev.unidade)}” foi fechada só no check, sem prática registrada — se “${unidadeCurta(pos.unidadeAtual)}” travar, ${nomeCurto} nela é a prova`;
      }
    }
  }

  // 2) O degrau atual com checks parciais e zero evidência — check-anotação.
  const mas = unitMasteryFor(code, pos.unidadeAtual, progress);
  if (mas.level === 'sem-registro' && pos.topicosFeitos > 0) {
    return `${pos.topicosFeitos} tópico(s) de “${unidadeCurta(pos.unidadeAtual)}” já marcados, mas nada registra prática — ${nomeCurto} é a prova, não o check`;
  }

  return null;
}

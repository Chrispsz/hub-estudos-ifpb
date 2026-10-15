// content-strategy.ts — CAMADA 2 DO MOTOR DE PRIORIDADE (Task 219, dono
// 15/10/2026: "vou fazer as 6 semanas de algoritmo pois é uma escadinha;
// matemática foca no assunto novo; e você avalia se vale a pena estudar o
// material anterior — o site deve servir ao curso inteiro, alimentado,
// sem nada defasado").
//
// A triagem (study-triage.ts) responde QUANDO e QUANTO investir por matéria.
// Esta camada responde O COMO o conteúdo cresce em cada uma:
//   · onde você está na escada (unidade atual, próximo degrau);
//   · SE vale a pena voltar ao material anterior — e em que regime
//     (fechar lacuna real / apoio pontual / consolidar é avançar / FSRS cuida).
//
// Tudo derivado de DADOS DO CURSO (course-data: estrategiaConteudo +
// conteudoProgramatico) e de FATOS REAIS (topicProgress do aluno + unidades
// liberadas por material de aula real — curriculum-state, o mesmo motor
// material-first do Praticar/Simulado). Lib PURA: nada lê storage; os
// chamadores injetam estado. Generaliza para o curso inteiro: períodos
// futuros herdam o campo e as mesmas regras.

import type { Discipline } from '@/data/course-data';
import { getCoveredUnits } from './curriculum-state';

// ---------------------------------------------------------------------------
// Posição na escada — por onde começar hoje
// ---------------------------------------------------------------------------

export interface EscadaPosicao {
  code: string;
  estrategia: Discipline['estrategiaConteudo'];
  /** Unidade corrente (nome completo do conteudoProgramatico). */
  unidadeAtual: string;
  /** "Unidade 2 de 5" — índice 1-based e total. */
  unidadeIdx: number;
  unidadeTotal: number;
  /** Próximos tópicos pendentes da unidade corrente, NA ORDEM do PPC. */
  proximosTopicos: string[];
  /** Fechados/total dentro da unidade corrente — progresso do degrau. */
  topicosFeitos: number;
  topicosNaUnidade: number;
  /** Frase humana curta — o motor sempre explica onde você está. */
  frase: string;
}

/** Nome curto de unidade: "Unidade 1: Noções de algoritmos…" → "Unidade 1". */
export function unidadeCurta(unidade: string): string {
  return unidade.split(':')[0]?.trim() ?? unidade;
}

/**
 * O degrau atual da disciplina.
 *  · escada/acumulo → a PRIMEIRA unidade com tópicos pendentes, na ordem do
 *    PPC (nunca pula degrau — o degrau aberto É o próximo passo);
 *  · assunto-novo → a unidade mais recente JÁ DADA EM AULA (material real,
 *    via curriculum-state) que ainda tem pendências — a aula manda, não o
 *    PPC; sem material de aula ainda, cai para a primeira pendente;
 *  · fluencia → primeira unidade pendente (produção contínua, sem rigidez).
 */
export function escadaPosicao(d: Discipline, topicProgress: { [topic: string]: boolean }): EscadaPosicao | null {
  const units = d.conteudoProgramatico;
  if (units.length === 0) return null;

  const done = (t: string) => topicProgress[t] === true;
  const pendentesDe = (u: { unidade: string; topicos: string[] }) => u.topicos.filter((t) => !done(t));

  let target: { unidade: string; topicos: string[] } | undefined;
  if (d.estrategiaConteudo === 'assunto-novo') {
    const covered = getCoveredUnits(d.code); // unidades que materiais de aula REAL comprovam
    for (let i = units.length - 1; i >= 0; i--) {
      const u = units[i];
      if (!covered.has(u.unidade)) continue;
      if (pendentesDe(u).length > 0) {
        target = u;
        break;
      }
    }
  }
  if (!target) {
    target = units.find((u) => pendentesDe(u).length > 0);
  }
  if (!target) {
    // tudo fechado — disciplina concluída não tem degrau
    return null;
  }

  const idx = units.findIndex((u) => u.unidade === target!.unidade) + 1;
  const proximos = pendentesDe(target);
  const feitos = target.topicos.length - proximos.length;

  const rotulo = unidadeCurta(target.unidade);
  let frase: string;
  switch (d.estrategiaConteudo) {
    case 'escada':
      frase = `Escada: ${rotulo} (${idx} de ${units.length}) — próximo degrau: ${proximos[0] ?? '—'}`;
      break;
    case 'acumulo':
      frase = `Empilhando: ${rotulo} (${idx} de ${units.length}) — consolide ${proximos[0] ?? '—'} e o que veio antes sustenta o próximo`;
      break;
    case 'assunto-novo':
      frase = `Assunto novo: ${rotulo} — foco em ${proximos[0] ?? '—'} (o que a aula trouxe agora)`;
      break;
    default:
      frase = `Rodando: ${rotulo} — toque em ${proximos[0] ?? '—'} para manter a produção`;
  }

  return {
    code: d.code,
    estrategia: d.estrategiaConteudo,
    unidadeAtual: target.unidade,
    unidadeIdx: idx,
    unidadeTotal: units.length,
    proximosTopicos: proximos,
    topicosFeitos: feitos,
    topicosNaUnidade: target.topicos.length,
    frase,
  };
}

// ---------------------------------------------------------------------------
// Vale voltar ao material anterior? — a pergunta exata do dono
// ---------------------------------------------------------------------------

export type OldMaterialVerdict = 'sim' | 'nao' | 'apoio';

export interface OldMaterialAdvice {
  verdict: OldMaterialVerdict;
  /** Frase humana — sempre explicando a regra, nunca "sentimento". */
  motivo: string;
}

/**
 * A avaliação honesta do material anterior, POR ESTRATÉGIA (generaliza para
 * qualquer disciplina de qualquer período):
 *  · escada     → VALE se a unidade ANTERIOR tem tópicos abertos: é lacuna de
 *                 pré-requisito, e a atual pisa nela. Se a anterior está
 *                 fechada, NÃO vale voltar por nostalgia — só quando um
 *                 degrau do presente travar.
 *  · acumulo    → VALE sempre, mas com reframe: consolidar o anterior É
 *                 avançar (HTML sustenta CSS sustenta o trabalho).
 *  · assunto-novo → APOIO: o material anterior só entra se o assunto novo
 *                 pisa nele — revise o mínimo que sustenta o novo.
 *  · fluencia   → APOIO: repetição espaçada leve (FSRS do hub vigia o que
 *                 já veio); o ganho está na produção nova.
 */
export function oldMaterialAdvice(
  d: Discipline,
  pos: EscadaPosicao | null,
  topicProgress: { [topic: string]: boolean },
): OldMaterialAdvice {
  switch (d.estrategiaConteudo) {
    case 'escada': {
      if (!pos || pos.unidadeIdx <= 1) {
        return {
          verdict: 'nao',
          motivo: 'você está no primeiro degrau — não há material anterior a rever, suba direto',
        };
      }
      // Pela construção da escada (o alvo é sempre a PRIMEIRA unidade com
      // pendências), chegar ao degrau N implica que a unidade N-1 está
      // fechada. A lacuna é estruturalmente impossível — a escada arrasta o
      // aluno de volta ao degrau aberto, sempre. Logo o veredito é "não
      // volte por conta": o retorno ao anterior só acontece como suporte
      // PONTUAL quando o degrau do presente travar.
      return {
        verdict: 'nao',
        motivo: 'base fechada — a escada só deixa subir com apoio; se travar no degrau atual, o anterior vira suporte pontual',
      };
    }
    case 'acumulo':
      return {
        verdict: 'sim',
        motivo: 'o anterior é matéria-prima do trabalho: consolidar o que veio antes É avançar no que vem',
      };
    case 'assunto-novo':
      return {
        verdict: 'apoio',
        motivo: 'só como apoio: revise o mínimo do antigo que sustenta o assunto novo — nada de re-estudar por conta',
      };
    default:
      return {
        verdict: 'apoio',
        motivo: 'revisão espaçada leve (o FSRS do hub vigia o antigo) — o ganho está em produzir com o novo',
      };
  }
}

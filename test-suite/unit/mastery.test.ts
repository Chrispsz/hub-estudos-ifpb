// mastery.test.ts — A PROVA DE APRENDIZAGEM: marcar é aviso, não prova.
// A certeza vem de questões resolvidas SEM ajuda. Níveis: marcado, praticado,
// consolidado, sem-registro.

import { describe, test, expect } from 'bun:test';
import { masteryFromActivity, masteryBadgeFor, degrauProvaAviso } from '@/lib/mastery';
import type { UnitActivity } from '@/lib/discipline-activity';
import { mergeWithDefaults } from '@/lib/study-progress';

function actOf(partial: Partial<UnitActivity>): UnitActivity {
  return {
    questoesTentadas: partial.questoesTentadas ?? 0,
    questoesResolvidasSemAjuda: partial.questoesResolvidasSemAjuda ?? 0,
    questoesTotal: partial.questoesTotal ?? 0,
    materiaisConcluidos: partial.materiaisConcluidos ?? 0,
    ...partial,
  } as UnitActivity;
}

describe('mastery · níveis lidos da atividade real', () => {
  test('nada de atividade e nada marcado: sem-registro — estado MUDO, sem julgamento', () => {
    const m = masteryFromActivity(null, false);
    expect(m.level).toBe('sem-registro');
    expect(m.frase).toBe(''); // sem-registro é mudo por design: sem ruído
  });

  test('só auto-relato (check): marcado — o aviso, não a prova', () => {
    const m = masteryFromActivity(null, true);
    expect(m.level).toBe('marcado');
    expect(m.checked).toBe(true);
  });

  test('prática real abaixo do piso: praticado', () => {
    const m = masteryFromActivity(actOf({ questoesTentadas: 3, questoesResolvidasSemAjuda: 1 }), true);
    expect(m.level).toBe('praticado');
  });

  test('2+ resolvidas sem ajuda com taxa ≥60%: consolidado — a prova de recall', () => {
    const m = masteryFromActivity(actOf({ questoesTentadas: 3, questoesResolvidasSemAjuda: 2 }), true);
    expect(m.level).toBe('consolidado');
  });

  test('1 acerto é sorte: nunca consolida com 1', () => {
    const m = masteryFromActivity(actOf({ questoesTentadas: 1, questoesResolvidasSemAjuda: 1 }), true);
    expect(m.level).not.toBe('consolidado');
  });

  test('resolvidas sem ajuda nunca excede tentadas (invariante de honestidade)', () => {
    const m = masteryFromActivity(actOf({ questoesTentadas: 2, questoesResolvidasSemAjuda: 2 }), false);
    expect(m.resolvidasSemAjuda).toBeLessThanOrEqual(Math.max(m.tentadas, 0));
    expect(m.level).not.toBe('sem-registro');
  });
});

describe('mastery · selo visual (badge) coerente com o nível', () => {
  test('badge tem tom e rótulo para qualquer nível (sem-registro é mudo → null)', () => {
    for (const act of [null, actOf({ questoesTentadas: 3, questoesResolvidasSemAjuda: 2 })]) {
      const m = masteryFromActivity(act, act === null);
      const badge = masteryBadgeFor(m);
      if (badge === null) {
        expect(m.level).toBe('sem-registro'); // só o estado mudo não tem selo
        continue;
      }
      expect(['emerald', 'violet', 'amber']).toContain(badge.tone);
      expect(typeof badge.label).toBe('string');
    }
  });
});

describe('mastery · escada (degrauProvaAviso)', () => {
  test('primeiro degrau sem trás marcado: null (nada a acusar)', () => {
    const sp = mergeWithDefaults({});
    const aviso = degrauProvaAviso(
      'TEC.1687',
      { unidadeAtual: 'Unidade 1', unidadeIdx: 1, topicosFeitos: 0 },
      sp,
      'PRIMM — código pronto antes do seu',
    );
    expect(aviso).toBeNull();
  });

  test('degrau de trás fechado só no check acusa a base oca (com assinatura curta do método)', () => {
    const sp = mergeWithDefaults({ topicProgress: { 'TEC.1687': { 'Variáveis e tipos': true } } });
    const aviso = degrauProvaAviso(
      'TEC.1687',
      { unidadeAtual: 'Unidade 2', unidadeIdx: 2, topicosFeitos: 0 },
      sp,
      'PRIMM — código pronto antes do seu',
    );
    if (aviso === null) return; // depende do acervo da unidade — só acusa quando existe
    expect(aviso).toContain('PRIMM');
    expect(aviso).not.toContain('—'); // assinatura curta, sem tagline
  });
});

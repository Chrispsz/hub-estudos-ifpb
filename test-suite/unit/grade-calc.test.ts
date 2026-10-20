// grade-calc.test.ts — A CALCULADORA DE MÉDIAS: régua oficial da faculdade.
// Preenchimento parcial é proporcional (não pune), escala 10 normaliza para 100.

import { describe, test, expect } from 'bun:test';
import { calcGrade, statusLabel, statusColor, formatNote } from '@/lib/grade-calc';
import { disciplines } from '@/data/course-data';
import type { Discipline } from '@/data/course-data';

const disc: Discipline | undefined = disciplines.find((d) => (d.gradeComponents?.length ?? 0) > 0);

describe('grade-calc · cálculo de médias com disciplina real da grade', () => {
  test('a grade tem disciplina com componentes de nota (o curso exige)', () => {
    expect(disc).toBeDefined();
    expect(disc!.gradeComponents.length).toBeGreaterThan(0);
  });

  if (!disc) return;
  const d = disc;

  test('sem nota nenhuma: incompleto, média null (nada inventado)', () => {
    const r = calcGrade(d, {});
    expect(r.status).toBe('incompleto');
    expect(r.ms).toBeNull();
  });

  test('todas as notas máximas: status final coerente com a régua', () => {
    const notes: Record<string, number> = {};
    for (const c of d.gradeComponents) notes[c.name] = c.scale;
    const r = calcGrade(d, notes);
    expect(r.ms).not.toBeNull();
    expect(r.status).not.toBe('incompleto');
  });

  test('preenchimento parcial é proporcional (não pune quem ainda não tem nota)', () => {
    const c0 = d.gradeComponents[0];
    const parcial = calcGrade(d, { [c0.name]: c0.scale });
    // MS parcial = nota normalizada (só um componente com peso total)
    expect(parcial.ms).not.toBeNull();
    const esperado = (d.scale === 10 ? c0.scale * 10 : c0.scale);
    expect(parcial.ms!).toBeCloseTo(esperado, 0);
  });

  test('escala 10 normaliza para 100 (nota 8 vira 80 no agregado)', () => {
    if (d.scale !== 10) return;
    const c0 = d.gradeComponents[0];
    const r = calcGrade(d, { [c0.name]: 8 });
    // só um componente preenchido: MS = nota normalizada (o peso se cancela)
    expect(r.ms).toBeCloseTo(80, 1);
  });

  test('af (avaliação final) entra no resultado quando presente', () => {
    const notes: Record<string, number> = {};
    for (const c of d.gradeComponents) notes[c.name] = Math.round(c.scale * 0.5);
    const r = calcGrade(d, notes, d.scale === 10 ? 6 : 60);
    expect(r.af).not.toBeNull();
  });
});

describe('grade-calc · voz da casa (rótulos e formatos)', () => {
  test('statusLabel devolve texto para qualquer resultado', () => {
    const discAny = disc ?? disciplines[0];
    for (const r of [
      calcGrade(discAny, {}),
      calcGrade(discAny, Object.fromEntries(discAny.gradeComponents.map((c) => [c.name, c.scale]))),
    ]) {
      expect(statusLabel(r).length).toBeGreaterThan(0);
      expect(typeof statusColor(r)).toBe('string');
    }
  });

  test('formatNote: null vira "—" e número sai em pt-BR (vírgula)', () => {
    expect(formatNote(null, 10)).toContain('—');
    expect(formatNote(7.5, 10)).toContain('7,5');
  });
});

// data-integrity.test.ts — O ACERVO É A FONTE ÚNICA DA VERDADE.
// O motor inteiro (fila, cronograma, prova, biblioteca) lê daqui. Uma
// referência quebrada aqui quebra TUDO em silêncio — então cada cruzamento
// do acervo é testado: matérias→disciplinas, exercícios→unidades,
// avaliações→disciplinas, pesos de nota somando 100%.

import { describe, test, expect } from 'bun:test';
import {
  disciplines,
  materials,
  evaluationPeriods,
  calendarEvents,
  course,
  importantLinks,
  weeklySchedule,
  classSlotTimes,
  slotTimeOf,
  weeklySchedules,
} from '@/data/course-data';
import { exercises } from '@/lib/exercise-extractor';

describe('acervo · disciplinas (a grade que comanda o motor)', () => {
  test('7 disciplinas do 1º período com códigos únicos', () => {
    expect(disciplines.length).toBe(7);
    const codes = disciplines.map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test('cada disciplina tem CH, régua de aprovação e conteúdo programático real', () => {
    for (const d of disciplines) {
      expect(d.chTotal).toBeGreaterThan(0);
      expect(d.approvalThreshold).toBeGreaterThan(0);
      expect(d.approvalThreshold).toBeLessThanOrEqual(100);
      expect(d.conteudoProgramatico.length).toBeGreaterThan(0);
      for (const u of d.conteudoProgramatico) {
        expect(u.unidade.length).toBeGreaterThan(0);
        expect(u.topicos.length).toBeGreaterThan(0);
      }
    }
  });

  test('pesos dos componentes de nota somam ~100% (a calculadora depende disso)', () => {
    for (const d of disciplines) {
      if (d.gradeComponents.length === 0) continue;
      const soma = d.gradeComponents.reduce((a, c) => a + c.weight, 0);
      expect(soma).toBeGreaterThan(99);
      expect(soma).toBeLessThanOrEqual(100.5);
    }
  });

  test('nomes curtos existem (a voz da casa usa em frases)', () => {
    for (const d of disciplines) {
      expect(d.shortName.length).toBeGreaterThan(0);
      expect(d.name.length).toBeGreaterThan(0);
    }
  });
});

describe('acervo · materiais (o que a casa serve)', () => {
  test('ids únicos — o progresso usa id como chave', () => {
    const ids = materials.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('todo material tem código de disciplina; os da grade são a maioria e os extras são conhecidos', () => {
    const gradeCodes = new Set(disciplines.map((d) => d.code));
    // Materiais fora da grade de 2026.2 existem por design (Inglês/Português
    // do ENEM-style, PNAAT, legado de períodos anteriores) — o que não pode
    // existir é CÓDIGO NOVO fora desta lista (typo em material novo quebra
    // a biblioteca em silêncio).
    const EXTRAS_CONHECIDOS = new Set(['TEC.1632', 'TEC.0953', '53647', 'ING.001', 'PORT.001', 'PNAAT']);
    const naGrade = materials.filter((m) => gradeCodes.has(m.disciplineCode)).length;
    expect(naGrade).toBeGreaterThan(0);
    for (const m of materials) {
      expect(m.disciplineCode.length).toBeGreaterThan(0);
      expect(
        gradeCodes.has(m.disciplineCode) || EXTRAS_CONHECIDOS.has(m.disciplineCode),
      ).toBe(true);
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.summaryFile.length).toBeGreaterThan(0);
    }
  });

  test('arquivos são caminhos do site (nunca URL absoluta) e web_page sempre tem conteúdo', () => {
    for (const m of materials) {
      if (m.pdfPath !== undefined) {
        expect(m.pdfPath.startsWith('/')).toBe(true);
        expect(m.pdfPath.startsWith('http')).toBe(false);
      }
      if (m.type === 'web_page') {
        // a página ou mora na web (externalUrl) ou virou PDF local (pdfPath) —
        // o que não pode existir é web_page sem conteúdo nenhum
        expect(!!m.externalUrl || !!m.pdfPath).toBe(true);
        if (m.externalUrl) expect(m.externalUrl).toMatch(/^https?:\/\//);
      }
    }
  });

  test('topicosCobertos referem unidades REAIS do conteúdo programático (padrão material-first)', () => {
    for (const m of materials) {
      if (!m.topicosCobertos) continue;
      const disc = disciplines.find((d) => d.code === m.disciplineCode);
      expect(disc).toBeDefined();
      const unidades = new Set(disc!.conteudoProgramatico.map((u) => u.unidade));
      for (const t of m.topicosCobertos) {
        expect(unidades.has(t)).toBe(true);
      }
    }
  });
});

describe('acervo · exercícios (a prática que prova aprendizagem)', () => {
  test('ids únicos e enunciado presente (a IA precisa ler o que reensinar)', () => {
    const ids = exercises.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(exercises.length).toBeGreaterThan(20);
    for (const e of exercises) {
      expect(e.statement.trim().length).toBeGreaterThan(0);
    }
  });

  test('disciplina e dificuldade sempre válidas', () => {
    const codes = new Set(disciplines.map((d) => d.code));
    for (const e of exercises) {
      expect(codes.has(e.disciplineCode)).toBe(true);
      expect(['facil', 'medio', 'dificil']).toContain(e.difficulty);
    }
  });

  test('unidade (quando declarada) existe no conteúdo programático da disciplina', () => {
    for (const e of exercises) {
      if (!e.unit) continue;
      const disc = disciplines.find((d) => d.code === e.disciplineCode);
      expect(disc).toBeDefined();
      const unidades = disc!.conteudoProgramatico.map((u) => u.unidade);
      expect(unidades.some((u) => e.unit!.includes(u) || u.includes(e.unit!))).toBe(true);
    }
  });

  test('linkedMaterials apontam para materiais que existem', () => {
    const matIds = new Set(materials.map((m) => m.id));
    for (const e of exercises) {
      for (const lm of e.linkedMaterials ?? []) {
        expect(matIds.has(lm)).toBe(true);
      }
    }
  });
});

describe('acervo · avaliações e calendário oficial (anti-estimativa)', () => {
  test('toda avaliação pertence a disciplina real e tem nome', () => {
    const codes = new Set(disciplines.map((d) => d.code));
    for (const e of evaluationPeriods) {
      expect(codes.has(e.disciplineCode)).toBe(true);
      expect(e.evaluationName.length).toBeGreaterThan(0);
    }
  });

  test('datas são ISO válidas (o radar e a véspera dependem disso)', () => {
    for (const e of evaluationPeriods) {
      if (!e.date) continue;
      expect(/^\d{4}-\d{2}-\d{2}$/.test(e.date)).toBe(true);
      expect(Number.isNaN(new Date(`${e.date}T00:00:00`).getTime())).toBe(false);
    }
  });

  test('eventos do calendário têm data válida e título', () => {
    for (const ev of calendarEvents) {
      expect(ev.title.length).toBeGreaterThan(0);
      expect(/^\d{4}-\d{2}-\d{2}$/.test(ev.date)).toBe(true);
    }
  });
});

describe('acervo · horários de aula e curso', () => {
  test('slotTimeOf resolve os encaixes do quadro e ignora lixo', () => {
    expect(classSlotTimes.length).toBeGreaterThan(0);
    for (const s of classSlotTimes) {
      expect(slotTimeOf(s.slot)).toBeDefined();
    }
    expect(slotTimeOf('slot-fantasma-xyz')).toBeUndefined();
  });

  test('grades semanais por período referem dias e encaixes coerentes', () => {
    for (const g of weeklySchedules) {
      for (const day of g.dias ?? []) {
        expect(day.dow).toBeGreaterThanOrEqual(0);
        expect(day.dow).toBeLessThanOrEqual(6);
        for (const s of day.slots ?? []) {
          expect(s.slot.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('curso e links essenciais preenchidos (campos em pt-BR: nome, nomeCurto)', () => {
    expect(course.nome.length).toBeGreaterThan(0);
    expect(course.nomeCurto.length).toBeGreaterThan(0);
    expect(course.campus.length).toBeGreaterThan(0);
    expect(importantLinks.length).toBeGreaterThan(0);
    expect(weeklySchedule !== undefined).toBe(true);
  });
});

// /api/tutor/signals — O USO DO TUTOR COMO SINAL DE APRENDIZAGEM (Task 226).
//
// O dono pediu: "se o tutor foi usado e quantas vezes usado… rastreado a
// atividade com o material, tutor, pomodoro, questões… para o algoritmo ser
// mais inteligente com base no aprendizado real". A memória do tutor JÁ mora
// no banco (TutorMessage por disciplina) — esta rota só a agrega em sinais:
//
//   · perguntas por disciplina nos ÚLTIMOS 7 DIAS (a semana corrente);
//   · total histórico + última vez usada;
//   · sem conteúdo, sem personalidade — só contagem (o texto das conversas
//     nunca sai da casa; a privacidade do dono manda).
//
// Consumidores: tracking-panel ("tutor 4× na semana"), dashboard (leitura do
// algoritmo) e weekly-report (momento de revisão — onde o tutor entrou).
// Erro devolve lista vazia + ok:false — o painel segue sem o sinal (nunca
// quebra a casa por causa de telemetria).

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TutorSignalEntry {
  code: string;
  last7d: number;
  total: number;
  lastUsedAt: string | null;
  /** Perguntas pedindo caminho/entendimento nos últimos 7d (uso saudável). */
  orientacao7d: number;
  /** Perguntas pedindo entrega pronta nos últimos 7d (sinal de dependência). */
  resposta7d: number;
  /** Neutras/legado (mensagens anteriores à Task 227 nascem 'outro'). */
  outro7d: number;
}

export async function GET() {
  try {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const rows = await db.tutorMessage.groupBy({
      by: ['discipline'],
      _count: { _all: true },
      _max: { createdAt: true },
    });

    const recent = await db.tutorMessage.findMany({
      where: { role: 'user', createdAt: { gte: since } },
      select: { discipline: true, createdAt: true, kind: true },
    });

    const recentCount = new Map<string, number>();
    // O MIX por disciplina (Task 227): predominância de 'resposta pronta'
    // vira narrativa de dependência; predominância de 'orientacao' vira uso
    // saudável — o dono SABE onde o tutor ensinou e onde só entregou.
    const recentKind = new Map<string, { o: number; r: number; x: number }>();
    for (const r of recent) {
      recentCount.set(r.discipline, (recentCount.get(r.discipline) ?? 0) + 1);
      const k = recentKind.get(r.discipline) ?? { o: 0, r: 0, x: 0 };
      if (r.kind === 'resposta') k.r += 1;
      else if (r.kind === 'orientacao') k.o += 1;
      else k.x += 1;
      recentKind.set(r.discipline, k);
    }

    const signals: TutorSignalEntry[] = rows
      .map((r) => {
        const k = recentKind.get(r.discipline);
        return {
          code: r.discipline,
          last7d: recentCount.get(r.discipline) ?? 0,
          total: r._count._all,
          lastUsedAt: r._max.createdAt?.toISOString() ?? null,
          orientacao7d: k?.o ?? 0,
          resposta7d: k?.r ?? 0,
          outro7d: k?.x ?? 0,
        };
      })
      .sort((a, b) => b.last7d - a.last7d || b.total - a.total);

    return NextResponse.json({ ok: true, signals });
  } catch {
    // Sem banco/sem tabela: sinal vazio — o painel segue de pé (telemetria
    // nunca derruba a casa).
    return NextResponse.json({ ok: false, signals: [] });
  }
}

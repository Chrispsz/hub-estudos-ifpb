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
      select: { discipline: true, createdAt: true },
    });

    const recentCount = new Map<string, number>();
    for (const r of recent) {
      recentCount.set(r.discipline, (recentCount.get(r.discipline) ?? 0) + 1);
    }

    const signals: TutorSignalEntry[] = rows
      .map((r) => ({
        code: r.discipline,
        last7d: recentCount.get(r.discipline) ?? 0,
        total: r._count._all,
        lastUsedAt: r._max.createdAt?.toISOString() ?? null,
      }))
      .sort((a, b) => b.last7d - a.last7d || b.total - a.total);

    return NextResponse.json({ ok: true, signals });
  } catch {
    // Sem banco/sem tabela: sinal vazio — o painel segue de pé (telemetria
    // nunca derruba a casa).
    return NextResponse.json({ ok: false, signals: [] });
  }
}

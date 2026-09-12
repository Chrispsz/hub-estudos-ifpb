// /api/tutor/history — memória das conversas do tutor por disciplina.
//  GET    ?discipline=TEC.1687 → últimas 40 mensagens (ordem cronológica)
//  DELETE ?discipline=TEC.1687 → apaga a conversa da disciplina ("Nova conversa")

import { db } from '@/lib/db';

export const runtime = 'nodejs';

const KEEP = 40;

function disciplineOf(req: Request): string | null {
  const raw = new URL(req.url).searchParams.get('discipline') ?? '';
  const key = raw.trim().slice(0, 40);
  return key || null;
}

export async function GET(req: Request) {
  try {
    const discipline = disciplineOf(req);
    if (!discipline) {
      return Response.json({ error: 'Parâmetro discipline obrigatório.' }, { status: 400 });
    }
    const rows = await db.tutorMessage.findMany({
      where: { discipline },
      orderBy: { createdAt: 'desc' },
      take: KEEP,
      select: { role: true, content: true, model: true, createdAt: true },
    });
    // devolve em ordem cronológica (mais antiga primeiro)
    const messages = rows.reverse().map((r) => ({
      role: r.role === 'user' ? 'user' : 'assistant',
      content: r.content,
      model: r.model ?? undefined,
    }));
    return Response.json({ messages });
  } catch (err) {
    console.error('[api/tutor/history] GET:', err instanceof Error ? err.message : err);
    return Response.json({ error: 'Falha ao carregar o histórico.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const discipline = disciplineOf(req);
    if (!discipline) {
      return Response.json({ error: 'Parâmetro discipline obrigatório.' }, { status: 400 });
    }
    const del = await db.tutorMessage.deleteMany({ where: { discipline } });
    return Response.json({ deleted: del.count });
  } catch (err) {
    console.error('[api/tutor/history] DELETE:', err instanceof Error ? err.message : err);
    return Response.json({ error: 'Falha ao limpar o histórico.' }, { status: 500 });
  }
}

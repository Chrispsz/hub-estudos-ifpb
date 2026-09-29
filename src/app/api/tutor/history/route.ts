// /api/tutor/history — memória das conversas do tutor por disciplina.
//  GET    ?discipline=TEC.1687 → últimas 80 mensagens (ordem cronológica),
//         cada uma com savedAt (ISO) — o CALENDÁRIO da conversa (t151):
//         separadores de dia e HH:MM nas restauradas. Campo ADITIVO — o
//         consumidor antigo que só lê role/content continua funcionando.
//  DELETE ?discipline=TEC.1687 → apaga a conversa da disciplina ("Nova conversa")
//  DELETE ?discipline=TEC.1687&after=ISO → apaga SÓ o que nasceu depois do
//         instante dado — a vassoura cirúrgica dos E2E (t147): o script
//         anota o relógio antes de mandar a pergunta de teste e se limpa
//         no fim, sem tocar UMA linha da memória real do aluno. Sem `after`
//         o DELETE continua apagando a disciplina inteira (é o que o botão
//         "Nova conversa" da casa espera).

import { db } from '@/lib/db';
import { normalizeMath } from '@/lib/sanitize-latex';
import { TUTOR_HISTORY_KEEP } from '@/lib/tutor-history-view';

export const runtime = 'nodejs';

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
      take: TUTOR_HISTORY_KEEP,
      select: { role: true, content: true, model: true, createdAt: true },
    });
    // devolve em ordem cronológica (mais antiga primeiro)
    // normalizeMath na leitura = auto-cura: mensagens antigas salvas com
    // \[...\]/\(...\) passam a renderizar no KaTeX sem migrar o banco
    const messages = rows.reverse().map((r) => ({
      role: r.role === 'user' ? 'user' : 'assistant',
      content: r.role === 'assistant' ? normalizeMath(r.content) : r.content,
      model: r.model ?? undefined,
      savedAt: r.createdAt.toISOString(),
    }));
    return Response.json({ messages });
  } catch (err) {
    // Sem banco (ex.: Vercel sem DATABASE_URL) → conversa vazia em vez de 500:
    // o chat abre só com o welcome e o tutor continua 100% utilizável.
    console.error('[api/tutor/history] GET:', err instanceof Error ? err.message : err);
    return Response.json({ messages: [] });
  }
}

export async function DELETE(req: Request) {
  try {
    const discipline = disciplineOf(req);
    if (!discipline) {
      return Response.json({ error: 'Parâmetro discipline obrigatório.' }, { status: 400 });
    }
    // Vassoura cirúrgica (t147): `after` recorta a janela de teste. Data
    // inválida → 400 alto (NUNCA interpretar lixo como "apagar tudo").
    const afterRaw = new URL(req.url).searchParams.get('after');
    let after: Date | null = null;
    if (afterRaw) {
      const d = new Date(afterRaw);
      if (Number.isNaN(d.getTime())) {
        return Response.json(
          { error: 'after inválido — use ISO 8601 (ex.: 2026-09-29T12:00:00.000Z).' },
          { status: 400 },
        );
      }
      after = d;
    }
    const del = await db.tutorMessage.deleteMany({
      where: { discipline, ...(after ? { createdAt: { gt: after } } : {}) },
    });
    return Response.json({ deleted: del.count });
  } catch (err) {
    // Sem banco → "nada a limpar" (a UI apenas reseta a conversa local).
    console.error('[api/tutor/history] DELETE:', err instanceof Error ? err.message : err);
    return Response.json({ deleted: 0 });
  }
}

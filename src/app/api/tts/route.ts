// /api/tts — voz IA para o botão "ouvir" do tutor (fallback do Web Speech).
//
// O cliente manda UM pedaço de texto (≤ 900 chars — ele mesmo fatia a resposta
// em frases) e recebe um wav pronto para <audio>. Formato: 'wav' é o único
// aceito pelo provedor ('mp3' retorna erro 1214 — testado em QA).
// Voz: 'tongtong'. Speed 1.15 (a voz base lê pt-BR devagar demais).
//
// IMPORTANTE (deploy): o z-ai-web-dev-sdk lê credenciais de um ARQUIVO
// (.z-ai-config em cwd/home/etc). No sandbox existe (/etc) e funciona;
// em deploys serverless sem o arquivo, respondemos 503 com uma mensagem
// clara — o cliente exibe e o usuário fica sabendo que a voz do navegador
// é o caminho (a nativa cobre os navegadores reais).

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';

const MAX_CHARS = 900;

/** O SDK exige um arquivo de config — detectamos a ausência ANTES para
 *  devolver 503 didático em vez de 500 genérico. */
async function configAvailable(): Promise<boolean> {
  const paths = [
    `${process.cwd()}/.z-ai-config`,
    `${process.env.HOME ?? ''}/.z-ai-config`,
    '/etc/.z-ai-config',
  ];
  for (const p of paths) {
    if (!p || p === '/.z-ai-config') continue;
    try {
      const raw = await fs.readFile(p, 'utf-8');
      const cfg = JSON.parse(raw) as { baseUrl?: string; apiKey?: string };
      if (cfg.baseUrl && cfg.apiKey) return true;
    } catch {
      // arquivo ausente/inválido — tenta o próximo
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
    const text =
      typeof body?.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : '';
    if (!text) {
      return NextResponse.json({ error: 'Texto vazio.' }, { status: 400 });
    }
    if (text.length > MAX_CHARS) {
      return NextResponse.json(
        { error: `Texto longo demais para um pedaço (máx. ${MAX_CHARS} caracteres).` },
        { status: 400 },
      );
    }

    if (!(await configAvailable())) {
      return NextResponse.json(
        {
          error:
            'A voz IA (servidor) não está configurada neste deploy — use a voz do navegador, que cobre os navegadores atuais.',
        },
        { status: 503 },
      );
    }

    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const res = await zai.audio.tts.create({
      input: text,
      voice: 'tongtong',
      speed: 1.15, // levemente acelerada: a voz base lê pt-BR devagar demais
      response_format: 'wav',
      stream: false,
    });
    const buffer = Buffer.from(new Uint8Array(await res.arrayBuffer()));
    if (buffer.length < 100) {
      throw new Error('O provedor devolveu um áudio vazio.');
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[/api/tts]', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: 'Não consegui gerar o áudio agora. Tenta de novo em instantes.' },
      { status: 500 },
    );
  }
}

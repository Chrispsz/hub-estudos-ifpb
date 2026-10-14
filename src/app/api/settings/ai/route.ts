// /api/settings/ai — A CHAVE PERFEITA (Task 214-b)
//
// A chave do Gemini entra aqui COMO DADO DO USUÁRIO: o dono cola na própria
// casa (Configurações → Inteligência da casa) e ela mora na tabela Setting do
// banco do servidor. Este endpoint NUNCA devolve a chave inteira — só a
// máscara ("AIza…abcd") — e NUNCA a loga. O trabalho pesado (ler a efetiva na
// cadeia do tutor) mora em src/lib/ai-settings.ts.
//
//  GET    → status honesto: hasKey, masked, source ('db'|'env'|null), modelo
//  POST   → salva chave e/ou preferência de modelo (validação frouxa; modelo
//           vazio remove a preferência — volta ao automático)
//  DELETE → remove a chave salva (a env volta a valer, se existir)

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {
  DEFAULT_GEMINI_ALIASES,
  clearSavedGeminiKey,
  clearSavedGeminiModel,
  getEffectiveGeminiConfig,
  getSavedGeminiModel,
  isValidGeminiKeyFormat,
  maskKey,
  setSavedGeminiKey,
  setSavedGeminiModel,
} from '@/lib/ai-settings';

/** Status atual — a MESMA forma usada por GET e POST (a UI atualiza com ela). */
async function statusResponse() {
  const [effective, savedModel] = await Promise.all([
    getEffectiveGeminiConfig(),
    getSavedGeminiModel(),
  ]);

  // Modelo: de onde vem a lista efetiva (db → env → aliases padrão).
  const modelSource: 'db' | 'env' | null = savedModel
    ? 'db'
    : process.env.GEMINI_MODEL
      ? 'env'
      : null;

  // SEGURANÇA: só a máscara sai daqui — a chave inteira NUNCA cruza a rede.
  return Response.json({
    hasKey: Boolean(effective.key),
    masked: effective.key ? maskKey(effective.key) : null,
    source: effective.source,
    model: effective.model,
    modelSaved: savedModel,
    modelSource,
    aliases: DEFAULT_GEMINI_ALIASES,
  });
}

export async function GET() {
  return statusResponse();
}

export async function POST(req: Request) {
  let body: { key?: unknown; model?: unknown };
  try {
    body = (await req.json()) as { key?: unknown; model?: unknown };
  } catch {
    return Response.json({ error: 'Corpo inválido (JSON esperado).' }, { status: 400 });
  }

  // ----- chave (opcional neste POST — pode vir só a preferência de modelo) ----
  if (body.key !== undefined) {
    const key = typeof body.key === 'string' ? body.key.trim() : '';
    if (!key) {
      return Response.json(
        { error: 'Cole a chave do Gemini (AI Studio) para salvar.' },
        { status: 400 },
      );
    }
    if (!isValidGeminiKeyFormat(key)) {
      return Response.json(
        {
          error:
            'Não parece uma chave do AI Studio — deve começar com "AIza" (clássica) ou "AQ." (nova) e ter pelo menos 30 caracteres. Confira em aistudio.google.com/app/apikey.',
        },
        { status: 400 },
      );
    }
    // Dado do dono entrando na casa: mora no banco, não no código, não no log.
    await setSavedGeminiKey(key);
  }

  // ----- preferência de modelo (opcional; string livre, trim; vazio remove) ----
  if (body.model !== undefined) {
    const model = typeof body.model === 'string' ? body.model.trim() : '';
    if (model) {
      await setSavedGeminiModel(model);
    } else {
      await clearSavedGeminiModel();
    }
  }

  return statusResponse();
}

export async function DELETE() {
  await clearSavedGeminiKey();
  return statusResponse();
}

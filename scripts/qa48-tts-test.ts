// Task 48 — testa o TTS do SDK no sandbox (o "ouvir" do tutor pode usar como fallback).
import ZAI from 'z-ai-web-dev-sdk';

async function main() {
  try {
    const zai = await ZAI.create();
    const res = await zai.audio.tts.create({
      input: 'Ola! Teste de voz do tutor.',
      voice: 'tongtong',
      speed: 1.0,
      response_format: 'wav',
      stream: false,
    });
    const buf = Buffer.from(new Uint8Array(await res.arrayBuffer()));
    console.log('OK — bytes:', buf.length, '| header:', buf.subarray(0, 3).toString('hex'));
  } catch (e) {
    console.error('FALHOU:', e instanceof Error ? e.message : String(e));
  }
}
main();

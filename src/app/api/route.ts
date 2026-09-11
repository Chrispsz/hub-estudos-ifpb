import { NextResponse } from "next/server";

/**
 * Health/status da API do Hub.
 *
 * ⚠️ CONTRATO FIXO — não alterar o shape da resposta (`{ message: string }`):
 * monitoramento e testes E2E dependem exatamente deste payload.
 */
export async function GET(): Promise<NextResponse<{ message: string }>> {
  return NextResponse.json({ message: "Hello, world!" });
}

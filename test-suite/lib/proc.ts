// proc.ts — execução de comandos com captura completa (peça de infra da cadeia).
// Usado pelas peças da cadeia para rodar lint, tsc, bun test e o agent-browser.

export interface CmdResult {
  cmd: string;
  args: string[];
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
  ms: number;
  timedOut: boolean;
}

const DEFAULT_TIMEOUT = 120_000;

export async function runCmd(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number; env?: Record<string, string> },
): Promise<CmdResult> {
  const started = Date.now();
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT;
  let timedOut = false;
  let proc: Bun.Subprocess<"ignore", "pipe", "pipe">;
  try {
    proc = Bun.spawn([cmd, ...args], {
      cwd: opts?.cwd ?? process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'ignore',
      env: opts?.env ? { ...process.env, ...opts.env } : process.env,
    });
  } catch (err) {
    return {
      cmd, args, ok: false, code: -1, stdout: '', stderr: String(err), ms: 0, timedOut: false,
    };
  }

  const timer = setTimeout(() => {
    timedOut = true;
    try { proc.kill(9); } catch { /* já morto */ }
  }, timeoutMs);

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  clearTimeout(timer);

  return {
    cmd,
    args,
    ok: code === 0 && !timedOut,
    code,
    stdout,
    stderr,
    ms: Date.now() - started,
    timedOut,
  };
}

/** Roda um comando no shell (para pipelines e redirecionamentos). */
export async function runShell(command: string, opts?: { cwd?: string; timeoutMs?: number }): Promise<CmdResult> {
  const started = Date.now();
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT;
  let timedOut = false;
  const proc = Bun.spawn(['bash', '-c', command], {
    cwd: opts?.cwd ?? process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: 'ignore',
  });
  const timer = setTimeout(() => {
    timedOut = true;
    try { proc.kill(9); } catch { /* já morto */ }
  }, timeoutMs);
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  clearTimeout(timer);
  return {
    cmd: command,
    args: [],
    ok: code === 0 && !timedOut,
    code,
    stdout,
    stderr,
    ms: Date.now() - started,
    timedOut,
  };
}

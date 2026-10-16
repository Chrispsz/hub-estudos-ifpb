'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import {
  Activity,
  AppWindow,
  BellRing,
  ChevronDown,
  CircleCheck,
  Cloud,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  DatabaseBackup,
  Download,
  ExternalLink,
  ImagePlus,
  Moon,
  RotateCcw,
  Settings2,
  Smartphone,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  TriangleAlert,
  RefreshCw,
  Upload,
  Volume2,
  VolumeX,
  XCircle,
  Gauge,
  Library,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { usePwaInstall } from '@/components/pwa';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { defaultProgress, exportProgressJSON, importProgressJSON, useStudyProgress } from '@/lib/study-progress';
import { useFocusMode } from '@/lib/focus-mode';
import { BACKUP_STAMP_KEY, backupStatus, progressWorthOf } from '@/lib/backup-guard';
import { useLocalStorage } from '@/lib/use-local-storage';

export function SettingsView() {
  const sp = useStudyProgress();
  const { theme, setTheme } = useTheme();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // O SELO DO BACKUP (172): a data do último export mora numa chave PRÓPRIA (não
  // dentro do progresso de propósito — importar um backup antigo não pode
  // fingir que o backup é novo). O useLocalStorage é a régua da casa: default
  // no primeiro render (sem mismatch), leitura pós-mount.
  const [lastExport, setLastExport] = useLocalStorage<string | null>(BACKUP_STAMP_KEY, null);
  // Confirmação de importação (172): substituir o progresso é destrutivo quando
  // há algo a perder — o diálogo diz O QUÊ em números antes do ato.
  const [pendingImport, setPendingImport] = React.useState<string | null>(null);

  const backup = backupStatus(lastExport);
  const worth = React.useMemo(() => progressWorthOf(sp.progress), [sp.progress]);

  const cfg = sp.progress.preferences;

  function handleExport() {
    try {
      const json = exportProgressJSON(sp.progress);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hub-estudos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      // O selo é o gesto inteiro: o download concluiu, o medidor recomeça.
      setLastExport(new Date().toISOString());
      toast.success('Backup exportado com sucesso!');
    } catch (e) {
      toast.error('Erro ao exportar: ' + (e as Error).message);
    }
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const imported = importProgressJSON(String(reader.result));
      if (!imported) {
        toast.error('Arquivo inválido — não parece um backup do Hub de Estudos.');
        return;
      }
      // NADA A PERDER = sem cerimônia (o estado vazio não tem o que destruir).
      if (worth.total === 0) {
        sp.replaceProgress(imported);
        toast.success('Progresso restaurado com sucesso!');
        return;
      }
      // HÁ ALGO A PERDER = o ato destrutivo passa pelo diálogo (o mesmo padrão
      // da Zona de risco: ação destrói, diálogo confessa em números).
      setPendingImport(String(reader.result));
    };
    reader.onerror = () => toast.error('Não foi possível ler o arquivo.');
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!pendingImport) return;
    const imported = importProgressJSON(pendingImport);
    setPendingImport(null);
    if (!imported) {
      toast.error('Arquivo inválido — não parece um backup do Hub de Estudos.');
      return;
    }
    sp.replaceProgress(imported);
    toast.success('Progresso restaurado com sucesso!');
  }

  const pomodoroStats = React.useMemo(
    () => ({
      sessions: sp.progress.pomodoroSessions.length,
      minutes: sp.progress.pomodoroSessions.reduce((acc, s) => acc + s.focusMinutes, 0),
    }),
    [sp.progress.pomodoroSessions],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Configurações</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aparência, Tutor IA, Pomodoro e dados — tudo fica no seu navegador.
        </p>
      </div>

      {/* ABAS (Task 221-b): o scroll único virou 4 casas — Aparência, Tutor IA,
          Pomodoro e Dados. No toque, grade 2×2 com alvo mínimo de 44px; no
          desktop, a linha clássica. O estado continua no pai — abas são só layout. */}
      <Tabs defaultValue="aparencia" className="gap-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg p-1 md:inline-flex md:h-9 md:w-auto md:gap-0">
          <TabsTrigger value="aparencia" className="min-h-11 px-3 md:min-h-0">
            <Sun className="size-4" aria-hidden />
            Aparência
          </TabsTrigger>
          <TabsTrigger value="tutor" className="min-h-11 px-3 md:min-h-0">
            <Sparkles className="size-4" aria-hidden />
            Tutor IA
          </TabsTrigger>
          <TabsTrigger value="pomodoro" className="min-h-11 px-3 md:min-h-0">
            <Timer className="size-4" aria-hidden />
            Pomodoro
          </TabsTrigger>
          <TabsTrigger value="dados" className="min-h-11 px-3 md:min-h-0">
            <DatabaseBackup className="size-4" aria-hidden />
            Dados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aparencia" className="space-y-5">
          {/* Aparência */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sun className="size-4 text-amber-500" aria-hidden />
                Aparência
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Tema</p>
                  <p className="text-xs text-muted-foreground">
                    AMOLED usa preto puro (padrão em telas OLED).
                  </p>
                </div>
                <Select value={theme ?? 'dark'} onValueChange={setTheme}>
                  <SelectTrigger className="w-40" aria-label="Selecionar tema">
                    <SelectValue placeholder="Tema" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">
                      <span className="flex items-center gap-2">
                        <Moon className="size-3.5" /> Escuro (AMOLED)
                      </span>
                    </SelectItem>
                    <SelectItem value="light">
                      <span className="flex items-center gap-2">
                        <Sun className="size-3.5" /> Claro
                      </span>
                    </SelectItem>
                    <SelectItem value="system">Sistema</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Modo foco (navegação simples)</p>
                  <p className="text-xs text-muted-foreground">
                    Esconde <b>Método</b>, <b>Cronograma</b> e <b>Progresso</b> atrás do botão "Mais"
                    na barra lateral — só o estudo do dia a dia na frente. Nada é apagado; um toque
                    em "Mais" traz de volta.
                  </p>
                </div>
                <FocusModeSwitch />
              </div>
            </CardContent>
          </Card>

          {/* Instalar como app (PWA) */}
          <InstallAppCard />
        </TabsContent>

        <TabsContent value="tutor" className="space-y-5">
          {/* Tutor IA (OpenRouter) */}
          <AiInfoCard />
        </TabsContent>

        <TabsContent value="pomodoro" className="space-y-5">
          {/* Pomodoro */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Timer className="size-4 text-emerald-500" aria-hidden />
                Pomodoro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberSetting
                  label="Foco (min)"
                  description="Duração de cada bloco"
                  ariaLabel="Minutos de foco"
                  value={cfg.pomodoroConfig.focus}
                  min={5}
                  max={90}
                  step={5}
                  fallback={25}
                  onCommit={(focus) =>
                    sp.updatePreferences({
                      pomodoroConfig: { ...cfg.pomodoroConfig, focus },
                    })
                  }
                />
                <NumberSetting
                  label="Pausa curta (min)"
                  description="Entre focos"
                  ariaLabel="Minutos de pausa curta"
                  value={cfg.pomodoroConfig.shortBreak}
                  min={1}
                  max={30}
                  fallback={5}
                  onCommit={(shortBreak) =>
                    sp.updatePreferences({
                      pomodoroConfig: { ...cfg.pomodoroConfig, shortBreak },
                    })
                  }
                />
                <NumberSetting
                  label="Pausa longa (min)"
                  description="A cada N ciclos"
                  ariaLabel="Minutos de pausa longa"
                  value={cfg.pomodoroConfig.longBreak}
                  min={5}
                  max={60}
                  step={5}
                  fallback={15}
                  onCommit={(longBreak) =>
                    sp.updatePreferences({
                      pomodoroConfig: { ...cfg.pomodoroConfig, longBreak },
                    })
                  }
                />
                <NumberSetting
                  label="Ciclos p/ pausa longa"
                  description="Focos antes da longa"
                  ariaLabel="Ciclos antes da pausa longa"
                  value={cfg.pomodoroConfig.cyclesBeforeLong}
                  min={2}
                  max={8}
                  fallback={4}
                  onCommit={(cyclesBeforeLong) =>
                    sp.updatePreferences({
                      pomodoroConfig: { ...cfg.pomodoroConfig, cyclesBeforeLong },
                    })
                  }
                />
                <NumberSetting
                  label="Meta diária"
                  description="Pomodoros por dia"
                  ariaLabel="Meta diária de pomodoros"
                  value={cfg.dailyGoal}
                  min={1}
                  max={12}
                  fallback={4}
                  onCommit={(dailyGoal) => sp.updatePreferences({ dailyGoal })}
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {cfg.silentMode ? (
                      <VolumeX className="size-4 text-muted-foreground" aria-hidden />
                    ) : (
                      <Volume2 className="size-4 text-emerald-500" aria-hidden />
                    )}
                    <div>
                      <p className="text-sm font-medium">Som ao trocar de fase</p>
                      <p className="text-xs text-muted-foreground">Beep discreto</p>
                    </div>
                  </div>
                  <Switch
                    checked={!cfg.silentMode}
                    onCheckedChange={(v) => sp.updatePreferences({ silentMode: !v })}
                    aria-label="Ativar som do Pomodoro"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ExternalLink
                      className={
                        cfg.backgroundTimer !== false
                          ? 'size-4 text-emerald-500'
                          : 'size-4 text-muted-foreground'
                      }
                      aria-hidden
                    />
                    <div>
                      <p className="text-sm font-medium">Rodar em outra guia</p>
                      <p className="text-xs text-muted-foreground">
                        O foco segue contando enquanto você pesquisa fora do Hub
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={cfg.backgroundTimer !== false}
                    onCheckedChange={(v) => sp.updatePreferences({ backgroundTimer: v })}
                    aria-label="Continuar o Pomodoro quando o Hub estiver em outra guia"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BellRing
                      className={
                        cfg.notifyPhaseEnd ? 'size-4 text-emerald-500' : 'size-4 text-muted-foreground'
                      }
                      aria-hidden
                    />
                    <div>
                      <p className="text-sm font-medium">Notificar fim das fases</p>
                      <p className="text-xs text-muted-foreground">Aviso do sistema ao concluir</p>
                    </div>
                  </div>
                  <Switch
                    checked={cfg.notifyPhaseEnd}
                    onCheckedChange={(v) => {
                      if (!v) {
                        sp.updatePreferences({ notifyPhaseEnd: false });
                        return;
                      }
                      if (!('Notification' in window)) {
                        toast.error('Este navegador não suporta notificações.');
                        return;
                      }
                      if (Notification.permission === 'granted') {
                        sp.updatePreferences({ notifyPhaseEnd: true });
                        toast.success('Notificações ativadas!');
                        return;
                      }
                      if (Notification.permission === 'denied') {
                        toast.error(
                          'Notificações bloqueadas — libere o site nas permissões do navegador.',
                        );
                        return;
                      }
                      Notification.requestPermission().then((p) => {
                        if (p === 'granted') {
                          sp.updatePreferences({ notifyPhaseEnd: true });
                          toast.success('Notificações ativadas!');
                        } else {
                          toast.info('Permissão não concedida — ative nas configurações do navegador.');
                        }
                      });
                    }}
                    aria-label="Ativar notificações do Pomodoro"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AppWindow
                      className={
                        cfg.tabTitleTimer ? 'size-4 text-teal-500' : 'size-4 text-muted-foreground'
                      }
                      aria-hidden
                    />
                    <div>
                      <p className="text-sm font-medium">Timer no título da aba</p>
                      <p className="text-xs text-muted-foreground">Ex.: “24:31 • Foco — Hub”</p>
                    </div>
                  </div>
                  <Switch
                    checked={cfg.tabTitleTimer}
                    onCheckedChange={(v) => sp.updatePreferences({ tabTitleTimer: v })}
                    aria-label="Mostrar timer no título da aba"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <RotateCcw
                      className={
                        cfg.includeReviews !== false
                          ? 'size-4 text-emerald-500'
                          : 'size-4 text-muted-foreground'
                      }
                      aria-hidden
                    />
                    <div>
                      <p className="text-sm font-medium">Revisar assuntos antigos</p>
                      <p className="text-xs text-muted-foreground">
                        O ciclo 1·3·7·14·30 volta ao plano — desligue para fila só de conteúdo novo e prova
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={cfg.includeReviews !== false}
                    onCheckedChange={(v) => sp.updatePreferences({ includeReviews: v })}
                    aria-label="Incluir revisão de assuntos antigos no cronograma"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="dados" className="space-y-5">
          {/* Backup */}
          <Card className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <DatabaseBackup className="size-4 text-teal-500" aria-hidden />
                Backup do progresso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {pomodoroStats.sessions}{' '}
                {pomodoroStats.sessions === 1 ? 'sessão' : 'sessões'} de Pomodoro (
                {pomodoroStats.minutes} min de foco acumulados) salvos no navegador. Exporte um JSON
                para não perder nada ao limpar o cache — um hábito semanal cobre o semestre inteiro.
              </p>
              {/* O MEDIDOR DO SEGURO (172): o export já existia; o que faltava era o
                  hábito ter um medidor. Cor = significado (a gramática da casa):
                  esmeralda em dia, âmbar semanal vencido, rosa mensal vencido, zinc
                  nunca exportou. O selo mora numa chave própria — importar um backup
                  antigo não finge que o backup é novo. */}
              <div
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium',
                  backup.tone === 'ok' && 'border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-700 dark:text-emerald-300',
                  backup.tone === 'warn' && 'border-amber-500/40 bg-amber-500/[0.07] text-amber-700 dark:text-amber-300',
                  backup.tone === 'danger' && 'border-rose-500/40 bg-rose-500/[0.07] text-rose-700 dark:text-rose-300',
                  backup.tone === 'never' && 'border-border bg-muted/40 text-muted-foreground',
                )}
                data-testid="backup-status"
              >
                {backup.tone === 'ok' ? (
                  <CircleCheck className="size-4 shrink-0" aria-hidden />
                ) : backup.tone === 'danger' ? (
                  <ShieldAlert className="size-4 shrink-0" aria-hidden />
                ) : (
                  <DatabaseBackup className="size-4 shrink-0" aria-hidden />
                )}
                <span className="min-w-0 flex-1">{backup.label}</span>
                {worth.total > 0 && (
                  <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
                    {worth.total === 1 ? '1 registro' : `${worth.total} registros`} no seguro
                  </span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="justify-start focus-visible:ring-emerald-500/60"
                  onClick={handleExport}
                >
                  <Download className="size-4 text-emerald-500" />
                  Exportar progresso (JSON)
                </Button>
                <Button
                  variant="outline"
                  className="justify-start focus-visible:ring-amber-500/60"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-4 text-amber-500" />
                  Importar progresso (JSON)
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  aria-label="Arquivo de backup JSON"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
              {/* A CONFIRMAÇÃO DA IMPORTAÇÃO (172): substituir o progresso é o mesmo
                  tipo de ato da Zona de risco — destrutivo e sem desfazer. Com algo
                  a perder, o diálogo confessa EM NÚMEROS o que vai embora; com o
                  estado vazio, a importação entra sem cerimônia (não há o que
                  destruir — pedir confirmação seria cerimônia disfarçada). */}
              <AlertDialog open={!!pendingImport} onOpenChange={(o) => !o && setPendingImport(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Substituir o progresso atual pelo backup?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2">
                        <p>
                          O progresso atual deste navegador será totalmente substituído pelo arquivo
                          escolhido. Nesta hora existem:
                        </p>
                        <ul className="space-y-1 text-xs">
                          <li className="tabular-nums">
                            • {worth.sessions} {worth.sessions === 1 ? 'sessão' : 'sessões'} de Pomodoro
                          </li>
                          <li className="tabular-nums">
                            • {worth.materials}{' '}
                            {worth.materials === 1 ? 'material concluído' : 'materiais concluídos'}
                          </li>
                          <li className="tabular-nums">
                            • {worth.flashcards} {worth.flashcards === 1 ? 'cartão' : 'cartões'} de
                            flashcards
                          </li>
                          <li className="tabular-nums">
                            • {worth.runs} {worth.runs === 1 ? 'corrida' : 'corridas'} de simulado
                          </li>
                        </ul>
                        <p>Esta ação não pode ser desfeita — exporte o atual antes, se precisar.</p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={confirmImport}
                      className="bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500/60"
                    >
                      Substituir tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* Zona de risco */}
          <Card className="rounded-xl border-rose-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-rose-500">
                <Settings2 className="size-4" aria-hidden />
                Zona de risco
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Isso apaga TODO o progresso local (sessões, tópicos, notas, cronograma). Exporte um
                backup antes!
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="justify-start">
                    <Trash2 className="size-4" />
                    Apagar todos os dados
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Apagar todos os dados?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Sessões de Pomodoro, tópicos concluídos, notas, preferências e cronograma serão
                      permanentemente removidos deste navegador. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => {
                        sp.replaceProgress({ ...defaultProgress });
                        toast.success('Dados apagados. Começando do zero!');
                      }}
                    >
                      <RotateCcw className="size-4" />
                      Sim, apagar tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator />

      {/* Sobre — versão mínima */}
      <p className="pb-2 text-center text-[11px] text-muted-foreground/70">
        Hub de Estudos IFPB v2.0 • dados 100% no seu navegador • IA: Gemini → OpenRouter → Z.ai →
        elo local (primeiro disponível)
      </p>
    </div>
  );
}

/**
 * Gaveta de explicação (Task 221-b): gatilho curto em cima, conteúdo completo
 * dentro — recolhido por padrão. Nada se perde; a tela deixa de ser manual.
 * Gatilho com toque mínimo de 44px (uso frequente no celular).
 */
function InfoCollapse({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Collapsible className="rounded-lg border">
      <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        {label}
        <ChevronDown
          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 border-t px-3 pb-3 pt-2.5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Linha repetida de configuração numérica do Pomodoro (rótulo + descrição + input com clamp). */
function NumberSetting({
  label,
  description,
  ariaLabel,
  value,
  min,
  max,
  step,
  fallback,
  onCommit,
}: {
  label: string;
  description: string;
  ariaLabel: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  fallback: number;
  onCommit: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) =>
          onCommit(Math.max(min, Math.min(max, Number(e.target.value) || fallback)))
        }
        className="h-11 w-20 text-center sm:h-9"
        aria-label={ariaLabel}
      />
    </div>
  );
}

/** Latência com cor semântica: verde < 1s, âmbar < 3s, vermelho acima. */
function msTone(ms: number): string {
  if (ms < 1000) return 'text-emerald-600 dark:text-emerald-400';
  if (ms < 3000) return 'text-amber-600 dark:text-amber-400';
  return 'text-destructive';
}

/** Linha de resultado do diagnóstico de IA (ping real de cada provedor). */
function ProbeRow({ label, r }: { label: string; r?: ProbeResult }) {
  if (!r) return null;
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className="flex min-w-0 items-center gap-1.5">
        {r.ok ? (
          <CircleCheck className="size-3 shrink-0 text-emerald-500" aria-hidden />
        ) : (
          <XCircle className="size-3 shrink-0 text-destructive" aria-hidden />
        )}
        <span className="font-medium">{label}</span>
        {/* fonte da chave do Gemini — o probe confessa de onde ela veio (214-b) */}
        {r.source ? (
          <span className="shrink-0 text-violet-600 dark:text-violet-400">· {r.source}</span>
        ) : null}
        {r.model ? <span className="truncate text-muted-foreground">· {r.model}</span> : null}
      </span>
      <span
        className={cn(
          'min-w-0 truncate text-right font-mono',
          r.ok ? msTone(r.ms) : 'text-destructive',
        )}
        title={r.ok ? `${r.ms} ms` : r.error}
      >
        {r.ok ? `${r.ms} ms` : (r.error ?? 'falhou')}
      </span>
    </div>
  );
}

type ProbeResult = { ok: boolean; ms: number; model?: string; error?: string; source?: string };
type VisionTestState =
  | { status: 'running' }
  | { status: 'ok'; model?: string; ms: number; transcription: string }
  | { status: 'fail'; error: string };
type ProbeState = {
  at: string;
  firstToAnswer: string;
  geminiKeySource?: string;
  gemini: ProbeResult;
  openrouter: ProbeResult;
  zai: ProbeResult;
};
/** Status da chave perfeita — GET/POST/DELETE /api/settings/ai (a chave NUNCA vem inteira). */
type AiSettingsStatus = {
  hasKey: boolean;
  masked: string | null;
  source: 'db' | 'env' | null;
  model: string[];
  modelSaved: string | null;
  modelSource: 'db' | 'env' | null;
  aliases: string[];
};

function AiInfoCard() {
  const [chains, setChains] = React.useState<{
    tutor: { id: string; label: string }[];
    flashcards: { id: string; label: string }[];
  } | null>(null);
  const [providers, setProviders] = React.useState<{
    gemini?: boolean;
    geminiSource?: 'db' | 'env' | null;
    openrouter?: boolean;
    zaiPublic?: boolean;
  } | null>(null);
  const [vision, setVision] = React.useState<string | null>(null);
  const [probe, setProbe] = React.useState<ProbeState | null>(null);
  const [probing, setProbing] = React.useState(false);
  const [visionTest, setVisionTest] = React.useState<VisionTestState | null>(null);
  const visionInputRef = React.useRef<HTMLInputElement>(null);

  // Painel de combustível (218): uso de hoje vs limites reais da key (AI Studio).
  const [fuel, setFuel] = React.useState<
    { id: string; quotaKey: string; tier: string; limit: number | null; used: number; exhausted: boolean }[]
  >([]);
  const [fuelSource, setFuelSource] = React.useState<string | null>(null);

  // Painel "O que o tutor sabe" (219-b): cobertura real do acervo + janelas
  // ativas do conhecimento — a memória de conteúdo do tutor, auditável.
  const [acervo, setAcervo] = React.useState<{
    materialsTotal: number;
    summariesTotal: number;
    textsTotal: number;
    perDiscipline: { code: string; shortName: string; materials: number; summaries: number; texts: number }[];
  } | null>(null);
  const [knowledge, setKnowledge] = React.useState<{
    durableCount: number;
    windowedActive: { id: string; text: string }[];
    windowedExpired: number;
    windowedFuture: number;
  } | null>(null);

  const visionAtiva = Boolean(vision && !vision.startsWith('somente'));

  /** Info viva do tutor (provedores/visão) — ao abrir e após salvar/remover a chave. */
  const loadTutorInfo = React.useCallback(() => {
    fetch('/api/tutor')
      .then((r) => r.json())
      .then((d) => {
        if (d?.chains) setChains(d.chains);
        if (d?.providers) setProviders(d.providers);
        if (typeof d?.vision === 'string') setVision(d.vision);
        if (Array.isArray(d?.fuel)) setFuel(d.fuel);
        if (typeof d?.fuelSource === 'string') setFuelSource(d.fuelSource);
        if (d?.acervo) setAcervo(d.acervo);
        if (d?.knowledge) setKnowledge(d.knowledge);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    loadTutorInfo();
  }, [loadTutorInfo]);

  /** Diagnóstico: ping real de cada chave (GET ?probe=1) — roda ao abrir e no botão. */
  const runProbe = React.useCallback(() => {
    setProbing(true);
    fetch('/api/tutor?probe=1')
      .then((r) => r.json())
      .then((d) => {
        if (d?.probe) setProbe(d.probe);
        else toast.error('Diagnóstico indisponível agora.');
      })
      .catch(() => toast.error('Não foi possível testar a conexão.'))
      .finally(() => setProbing(false));
  }, []);

  React.useEffect(() => {
    runProbe();
  }, [runProbe]);

  /** Chave salva/removida na casa → a casa inteira se atualiza: badges, visão e probe. */
  const refreshAfterKeyChange = React.useCallback(() => {
    loadTutorInfo();
    runProbe();
  }, [loadTutorInfo, runProbe]);

  /** Teste real de visão: lê uma imagem escolhida pelo usuário pela MESMA cadeia do tutor. */
  const runVisionTest = React.useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Escolha um arquivo de imagem (print, foto do exercício…).');
      return;
    }
    setVisionTest({ status: 'running' });
    const reader = new FileReader();
    reader.onload = () => {
      const t0 = Date.now();
      fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question:
            'Transcreva EXATAMENTE o texto principal que aparece na imagem. Responda em uma linha curta, sem comentários.',
          discipline: 'Diagnóstico',
          disciplineCode: 'QA-VIS',
          stream: false,
          imageDataUrl: String(reader.result),
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          const ms = Date.now() - t0;
          if (d?.answer) {
            // Exibição limpa: modelos costumam responder prints com LaTeX ($$…$/$…$) —
            // no diagnóstico mostramos o texto puro, sem delimitadores.
            const clean = String(d.answer)
              .trim()
              .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
              .replace(/\$([^$\n]+)\$/g, '$1')
              .replace(/\\[a-zA-Z]+/g, '')
              .replace(/\s{2,}/g, ' ')
              .trim();
            setVisionTest({
              status: 'ok',
              model: d.model,
              ms,
              transcription: clean,
            });
            toast.success('Visão funcionando — a imagem foi lida com sucesso.');
          } else {
            setVisionTest({
              status: 'fail',
              error: d?.error ?? 'A imagem não pôde ser lida agora. Tente outro print.',
            });
          }
        })
        .catch(() =>
          setVisionTest({ status: 'fail', error: 'Falha de rede ao testar a leitura.' }),
        );
    };
    reader.readAsDataURL(file);
  }, []);

  const anyKey = Boolean(providers?.gemini || providers?.openrouter || providers?.zaiPublic);

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-violet-500" aria-hidden />
          Tutor IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <InfoCollapse label="Como funciona a cadeia de modelos">
          <p className="text-xs text-muted-foreground">
            O tutor, a leitura de prints e o gerador de flashcards rodam em modelos{' '}
            <b>gratuitos</b> com fallback automático <b>ciente de combustível</b>: os limites reais
            da sua key são vigiados — quando um modelo chega perto do teto diário, o próximo assume{' '}
            <b>antes</b> do 429. Sem erro para você, sem interrupção para a casa.
          </p>
          {chains ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-semibold">Chat do tutor</p>
                <ol className="space-y-1 text-xs text-muted-foreground">
                  {chains.tutor.map((m, i) => (
                    <li key={m.id} className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-emerald-500">{i + 1}º</span>
                      {m.label}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold">Gerador de flashcards</p>
                <ol className="space-y-1 text-xs text-muted-foreground">
                  {chains.flashcards.map((m, i) => (
                    <li key={m.id} className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-violet-500">{i + 1}º</span>
                      {m.label}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            <div className="h-12 animate-pulse rounded-lg bg-muted/50" aria-hidden />
          )}
        </InfoCollapse>

        {providers && (
          <div className="flex flex-wrap items-center gap-2" aria-label="Provedores de IA configurados">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                providers.gemini
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-muted bg-muted/40 text-muted-foreground'
              }`}
            >
              {providers.gemini ? <CircleCheck className="size-3" aria-hidden /> : null}
              Gemini {providers.gemini ? 'ativo' : 'inativo'}
              {providers.gemini && providers.geminiSource === 'db'
                ? ' · chave da casa'
                : ''}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                providers.openrouter
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-muted bg-muted/40 text-muted-foreground'
              }`}
            >
              {providers.openrouter ? (
                <CircleCheck className="size-3" aria-hidden />
              ) : null}
              OpenRouter {providers.openrouter ? 'ativo' : 'inativo'}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                providers.zaiPublic
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-muted bg-muted/40 text-muted-foreground'
              }`}
            >
              {providers.zaiPublic ? <CircleCheck className="size-3" aria-hidden /> : null}
              Z.ai {providers.zaiPublic ? 'ativo' : 'inativo'}
            </span>
          </div>
        )}

        {providers && (
          <p className="text-xs text-muted-foreground">
            <b
              className={
                vision && !vision.startsWith('somente')
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : ''
              }
            >
              Leitura de prints (visão):
            </b>{' '}
            {vision ?? 'verificando…'}
          </p>
        )}

        {/* A CHAVE PERFEITA (214-b): a chave do Gemini como DADO DO DONO — entra
            aqui, mora no servidor, volta mascarada, é removível. Salvar/remover
            atualiza badges + probe na hora (o tutor já lê a chave nova no
            próximo call — nada de rede a mais por chamada, cache no servidor). */}
        <HouseIntelligenceCard onStatusChange={refreshAfterKeyChange} />

        {providers && visionAtiva && (
          <div className="rounded-lg border p-3" aria-live="polite">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <ImagePlus className="size-3.5 text-violet-500" aria-hidden />
                Testar leitura de prints
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 px-2.5 text-[11px]"
                onClick={() => visionInputRef.current?.click()}
                disabled={visionTest?.status === 'running'}
              >
                {visionTest?.status === 'running' ? (
                  <RefreshCw className="size-3 animate-spin" aria-hidden />
                ) : (
                  <ImagePlus className="size-3" aria-hidden />
                )}
                {visionTest?.status === 'running' ? 'Lendo imagem…' : 'Enviar imagem'}
              </Button>
            </div>
            <input
              ref={visionInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Escolher imagem para testar a leitura"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) runVisionTest(f);
                e.target.value = '';
              }}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Envie um print (foto do exercício ou do quadro) e veja em tempo real qual modelo lê e
              o que entendeu — exatamente como será no chat.
            </p>
            {visionTest?.status === 'ok' && (
              <div className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-[11px]">
                <p className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                  <CircleCheck className="size-3 shrink-0" aria-hidden />
                  Lido por {visionTest.model ?? 'IA'} em {(visionTest.ms / 1000).toFixed(1)}s
                </p>
                <p
                  className="mt-1 line-clamp-3 break-words text-muted-foreground"
                  title={visionTest.transcription}
                >
                  “{visionTest.transcription}”
                </p>
              </div>
            )}
            {visionTest?.status === 'fail' && (
              <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px]">
                <p className="flex items-start gap-1.5 font-medium text-destructive">
                  <XCircle className="mt-0.5 size-3 shrink-0" aria-hidden />
                  {visionTest.error}
                </p>
              </div>
            )}
          </div>
        )}

        {providers && (
          <div className="rounded-lg border p-3" aria-live="polite">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <Activity className="size-3.5 text-emerald-500" aria-hidden />
                Teste de conexão das chaves
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 px-2.5 text-[11px]"
                onClick={runProbe}
                disabled={probing}
              >
                <RefreshCw className={cn('size-3', probing && 'animate-spin')} aria-hidden />
                {probing ? 'Testando…' : 'Testar agora'}
              </Button>
            </div>
            <div className="mt-2 space-y-1.5">
              {probing && !probe ? (
                <p className="text-[11px] text-muted-foreground">
                  Medindo latência de cada provedor…
                </p>
              ) : null}
              {probe ? (
                <>
                  <ProbeRow label="Gemini (AI Studio)" r={probe.gemini} />
                  <ProbeRow label="OpenRouter (cadeia free)" r={probe.openrouter} />
                  <ProbeRow label="Z.ai (opcional)" r={probe.zai} />
                  <p className="pt-0.5 text-[11px] text-muted-foreground">
                    Quem responde primeiro nas dúvidas reais:{' '}
                    <b className="font-semibold text-foreground">{probe.firstToAnswer}</b>
                  </p>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* COMBUSTÍVEL DE HOJE (218): os limites reais da key do dono (painel
            "Limites de taxa" do AI Studio) + o que a casa registrou hoje. O
            roteador pula o balde seco ANTES do 429 — "sem interrupções" virou
            engenharia, não promessa. */}
        {providers?.gemini && fuel.length > 0 && (
          <div className="rounded-lg border p-3" aria-live="polite">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <Gauge className="size-3.5 text-violet-500" aria-hidden />
              Combustível de hoje — limites reais da sua key
            </p>
            <div className="mt-2 space-y-2.5">
              {fuel.map((f) => {
                const pct = f.limit ? Math.min(100, Math.round((f.used / f.limit) * 100)) : 0;
                const bar =
                  f.exhausted || pct >= 100
                    ? 'bg-destructive'
                    : pct >= 60
                      ? 'bg-amber-500'
                      : 'bg-emerald-500';
                return (
                  <div key={f.id}>
                    <div className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="font-medium">
                        {f.quotaKey
                          .split('-')
                          .map((w) =>
                            /^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
                          )
                          .join(' ')}
                        {f.id !== f.quotaKey && (
                          <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                            via {f.id}
                          </span>
                        )}
                        <span className="ml-1.5 text-muted-foreground">
                          ({f.tier === 'premium' ? 'o mais capaz · 20/dia' : f.tier === 'workhorse' ? 'o trabalhador' : 'extra'})
                        </span>
                      </span>
                      <span
                        className={cn(
                          'font-mono',
                          f.exhausted ? 'text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {f.used}/{f.limit ?? '—'}
                        {f.exhausted ? ' · exausto — próximo assume' : ''}
                      </span>
                    </div>
                    {f.limit ? (
                      <div
                        className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                        role="presentation"
                      >
                        <div
                          className={cn('h-full rounded-full transition-all', bar)}
                          style={{ width: `${Math.max(pct, f.used > 0 ? 3 : 0)}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Quando um modelo seca, o próximo da cadeia assume <b>antes</b> do 429 — premium para
              o difícil, lite (500/dia) para o volume. {fuelSource ?? ''}
            </p>
          </div>
        )}

        {/* O QUE O TUTOR SABE (219-b): a memória de conteúdo do tutor, visível e
            auditável — a mesma fonte que o retrieval usa. Responde ao dono:
            "a IA tem contexto máximo de qualquer conteúdo? e dos novos?" */}
        {acervo && acervo.materialsTotal > 0 && (
          <div className="rounded-lg border p-3" aria-live="polite" data-t="acervo-panel">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <Library className="size-3.5 text-violet-500" aria-hidden />
              O que o tutor sabe — memória de conteúdo
            </p>

            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {[
                { n: acervo.materialsTotal, l: 'materiais no acervo' },
                { n: acervo.summariesTotal, l: 'com resumo IA' },
                { n: acervo.textsTotal, l: 'com texto pesquisável' },
              ].map((s) => (
                <div key={s.l} className="rounded-md border bg-muted/30 px-1 py-1.5">
                  <p className="text-sm font-semibold tabular-nums">{s.n}</p>
                  <p className="text-[10px] leading-tight text-muted-foreground">{s.l}</p>
                </div>
              ))}
            </div>

            <div className="mt-2.5 space-y-2">
              <InfoCollapse label="Cobertura por disciplina">
                <div className="space-y-1.5">
                  {acervo.perDiscipline
                    .filter((r) => r.materials > 0)
                    .map((r) => {
                      const pctSum = Math.round((r.summaries / r.materials) * 100);
                      const pctTxt = Math.round((r.texts / r.materials) * 100);
                      const dot =
                        pctSum >= 100 && pctTxt >= 100
                          ? 'bg-emerald-500'
                          : pctSum > 0 || pctTxt > 0
                            ? 'bg-amber-500'
                            : 'bg-muted-foreground/40';
                      return (
                        <div key={r.code} className="flex items-center gap-2 text-[11px]">
                          <span className={cn('size-1.5 shrink-0 rounded-full', dot)} aria-hidden />
                          <span className="w-28 shrink-0 truncate font-medium">{r.shortName}</span>
                          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-emerald-500/80"
                              style={{ width: `${pctSum}%` }}
                              title={`resumo IA: ${r.summaries}/${r.materials}`}
                            />
                          </div>
                          <span className="w-24 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                            {r.summaries}·{r.texts}/{r.materials}
                          </span>
                        </div>
                      );
                    })}
                </div>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Resumo IA estruturado + texto do PDF pesquisável por trecho (com páginas). A
                  pergunta escolhe o material certo — o tutor não lê tudo de uma vez, ele{' '}
                  <b>busca</b> o trecho relevante a cada dúvida.
                </p>
              </InfoCollapse>

              {knowledge && (knowledge.windowedActive.length > 0 || knowledge.durableCount > 0) && (
                <InfoCollapse label="Ver o que o tutor ouve hoje (estado do semestre)">
                  <div>
                    <p className="text-[11px] font-semibold">
                      Estado do semestre que o tutor ouve HOJE
                      <span className="ml-1 font-normal text-muted-foreground">
                        ({knowledge.durableCount} fatos duráveis ·{' '}
                        {knowledge.windowedActive.length} janela(s) ativa(s)
                        {knowledge.windowedExpired > 0
                          ? ` · ${knowledge.windowedExpired} expirada(s) somem sozinhas`
                          : ''}
                        {knowledge.windowedFuture > 0
                          ? ` · ${knowledge.windowedFuture} futura(s)`
                          : ''})
                      </span>
                    </p>
                    <ul className="mt-1 max-h-36 space-y-1 overflow-y-auto pr-1">
                      {knowledge.windowedActive.map((w) => (
                        <li key={w.id} className="text-[11px] leading-snug text-muted-foreground">
                          <span className="mr-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-1 py-px text-[9px] text-violet-600 dark:text-violet-400">
                            janela
                          </span>
                          {w.text.replace(/^- /, '')}
                        </li>
                      ))}
                    </ul>
                  </div>
                </InfoCollapse>
              )}

              <InfoCollapse label="Como alimentar o acervo">
                <p className="text-[11px] font-semibold">
                  Como alimentar (o acervo cresce com você):
                </p>
                <ol className="list-inside list-decimal space-y-0.5 text-[11px] leading-snug text-muted-foreground">
                  <li>Mande aqui no chat o PDF, print, lista ou programa em C;</li>
                  <li>
                    a casa acerva: arquivo + resumo IA + texto pesquisável (a IA já “estudou” quando
                    o painel acima sobe);
                  </li>
                  <li>
                    de lá em diante o tutor acessa SOZINHO em qualquer pergunta — sem você precisar
                    reenviar nada.
                  </li>
                </ol>
              </InfoCollapse>
            </div>
          </div>
        )}

        {providers && !anyKey && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <p className="flex items-start gap-1.5 font-medium">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Nenhuma chave de IA configurada — o tutor só funciona em desenvolvimento.
            </p>
            <p className="mt-1 leading-relaxed">
              <b>Opção 1 (recomendada)</b>: key grátis do Google AI Studio em{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 underline underline-offset-2"
              >
                aistudio.google.com/app/apikey <ExternalLink className="size-3" aria-hidden />
              </a>{' '}
              → cole no card <b>Inteligência da casa</b> acima (mora no servidor como dado do dono).
              Uma key só resolve texto <b>e</b> leitura de prints, com bom limite diário grátis.
            </p>
            <p className="mt-1 leading-relaxed">
              <b>Opção 2</b>: key grátis na{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 underline underline-offset-2"
              >
                openrouter.ai/keys <ExternalLink className="size-3" aria-hidden />
              </a>{' '}
              → <code className="rounded bg-amber-500/15 px-1 font-mono text-[10px]">OPENROUTER_API_KEY</code>.
              Ambas vão nas Environment Variables da Vercel (Settings → Environment Variables).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Card "Instalar como app" — usa o prompt nativo do Chrome/Edge quando disponível. */
function InstallAppCard() {
  const [canInstall, install] = usePwaInstall();

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="size-4 text-teal-500" aria-hidden />
          Instalar como app
        </CardTitle>
      </CardHeader>
      <CardContent>
        {canInstall ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">O Hub pode virar um app no seu dispositivo</p>
              <p className="text-xs text-muted-foreground">
                Ícone na tela inicial, tela cheia e sem barra de navegador.
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-teal-600 text-white hover:bg-teal-700"
              onClick={async () => {
                const ok = await install();
                if (ok) toast.success('App instalado! Procure o ícone 📱 na sua tela inicial.');
              }}
            >
              <AppWindow className="size-3.5" /> Instalar agora
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p className="text-sm font-medium text-foreground">Como instalar manualmente:</p>
            <p>
              <span className="font-semibold text-foreground/80">Android/Chrome:</span> menu ⋮ →{' '}
              <em>Adicionar à tela inicial</em> (ou <em>Instalar app</em>).
            </p>
            <p>
              <span className="font-semibold text-foreground/80">iPhone/Safari:</span> botão{' '}
              <em>Compartilhar</em> → <em>Adicionar à Tela de Início</em>.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
/**
 * A CHAVE PERFEITA (Task 214-b) — "Inteligência da casa":
 * o dono cola a chave do Gemini AI Studio e ela vira DADO DO USUÁRIO — mora na
 * tabela Setting do servidor, volta mascarada ("AIza…abcd"), é removível, e a
 * cadeia do tutor passa a usá-la ANTES das variáveis de ambiente. Nada de
 * chave no código, no git ou no log — o input é type=password e o servidor só
 * devolve a máscara. `onStatusChange` liga este card ao "Testar agora" e aos
 * badges: salvar/remover refresca a casa inteira.
 */
function HouseIntelligenceCard({ onStatusChange }: { onStatusChange: () => void }) {
  const [status, setStatus] = React.useState<AiSettingsStatus | null>(null);
  const [keyDraft, setKeyDraft] = React.useState('');
  const [modelDraft, setModelDraft] = React.useState('');
  const [busy, setBusy] = React.useState<'save' | 'remove' | null>(null);

  React.useEffect(() => {
    fetch('/api/settings/ai')
      .then((r) => r.json())
      .then((d: AiSettingsStatus) => {
        if (typeof d?.hasKey !== 'boolean') return;
        setStatus(d);
        setModelDraft(d.modelSaved ?? '');
      })
      .catch(() => {});
  }, []);

  const hasSavedKey = status?.source === 'db';

  /** Salva chave e/ou preferência de modelo (o servidor re-valida tudo). */
  const save = async () => {
    const key = keyDraft.trim();
    const model = modelDraft.trim();
    const modelChanged = model !== (status?.modelSaved ?? '');
    if (!key && !modelChanged) {
      toast.error('Cole sua chave do Gemini (AI Studio) para salvar.');
      return;
    }
    // Validação frouxa no cliente (a prova real é o "Testar agora" no servidor):
    if (key && !key.startsWith('AIza')) {
      toast.error('A chave do Gemini começa com "AIza" — confira o que você colou.');
      return;
    }
    if (key && key.length < 30) {
      toast.error('A chave parece curta demais — confira se copiou inteira.');
      return;
    }
    setBusy('save');
    try {
      const body: Record<string, string> = {};
      if (key) body.key = key;
      if (modelChanged) body.model = model; // '' = automático (limpa a preferência)
      const res = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = (await res.json()) as AiSettingsStatus & { error?: string };
      if (!res.ok) {
        toast.error(d?.error ?? 'Não foi possível salvar a chave.');
        return;
      }
      setStatus(d);
      setModelDraft(d.modelSaved ?? '');
      setKeyDraft('');
      toast.success(
        body.key
          ? 'Chave salva na casa — o tutor já usa no próximo call.'
          : 'Preferência de modelo salva.',
      );
      onStatusChange();
    } catch {
      toast.error('Falha de rede ao salvar a chave.');
    } finally {
      setBusy(null);
    }
  };

  /** Remove a chave salva — a casa volta para a env (ou para o elo local). */
  const remove = async () => {
    setBusy('remove');
    try {
      const res = await fetch('/api/settings/ai', { method: 'DELETE' });
      const d = (await res.json()) as AiSettingsStatus & { error?: string };
      if (!res.ok) {
        toast.error(d?.error ?? 'Não foi possível remover a chave.');
        return;
      }
      setStatus(d);
      setModelDraft(d.modelSaved ?? '');
      toast.success('Chave removida — a casa volta para a variável de ambiente (ou o elo local).');
      onStatusChange();
    } catch {
      toast.error('Falha de rede ao remover a chave.');
    } finally {
      setBusy(null);
    }
  };

  // STATUS HONESTO — a casa confessa quem está atendendo (nunca a chave inteira).
  const statusLine = !status
    ? null
    : status.hasKey && status.source === 'db'
      ? { tone: 'db' as const, text: `chave salva na casa (${status.masked ?? '—'})` }
      : status.hasKey && status.source === 'env'
        ? { tone: 'env' as const, text: 'usando variável de ambiente (GEMINI_API_KEY)' }
        : { tone: 'none' as const, text: 'nenhuma chave — a casa usa o elo local' };

  const modelLine = !status
    ? null
    : status.modelSource === 'db'
      ? `Agora em uso: modelo fixado por você (${status.model[0]}).`
      : status.modelSource === 'env'
        ? `Agora em uso: modelo pela env (${status.model[0]}).`
        : `Agora em uso: automático — aliases vivos (${status.model.join(' → ')}).`;

  return (
    <div className="rounded-lg border border-violet-500/30 p-3" data-testid="house-intelligence">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          <KeyRound className="size-3.5 text-violet-500" aria-hidden />
          Inteligência da casa
        </p>
        {hasSavedKey && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2.5 text-[11px] focus-visible:ring-rose-500/60"
            onClick={() => void remove()}
            disabled={busy !== null}
          >
            <Trash2 className="size-3 text-destructive" aria-hidden />
            {busy === 'remove' ? 'Removendo…' : 'Remover chave'}
          </Button>
        )}
      </div>

      {/* STATUS HONESTO */}
      <div
        data-testid="ai-key-status"
        aria-live="polite"
        className={cn(
          'mt-2 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] font-medium',
          statusLine?.tone === 'db' &&
            'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
          statusLine?.tone === 'env' &&
            'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          statusLine?.tone === 'none' && 'border-border bg-muted/40 text-muted-foreground',
        )}
      >
        {statusLine?.tone === 'db' ? (
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
        ) : statusLine?.tone === 'env' ? (
          <CircleCheck className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <KeyRound className="size-3.5 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1 break-words">
          {statusLine?.text ?? 'consultando o servidor da casa…'}
        </span>
      </div>

      {/* ENTRADA DA CHAVE + PREFERÊNCIA DE MODELO */}
      <div className="mt-2 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="password"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="cole sua chave do Gemini (AI Studio)"
            className="h-11 flex-1 font-mono text-xs sm:h-9"
            aria-label="Chave da API do Google Gemini (AI Studio) — só fica no servidor da casa"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
            }}
          />
          <Button
            size="sm"
            className="h-11 shrink-0 bg-violet-600 px-3 text-white hover:bg-violet-700 focus-visible:ring-violet-500/60 sm:h-9"
            onClick={() => void save()}
            disabled={busy !== null}
          >
            {busy === 'save' ? (
              <RefreshCw className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <ShieldCheck className="size-3.5" aria-hidden />
            )}
            {busy === 'save' ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
        <Input
          placeholder="gemini-flash-latest (vazio = automático)"
          autoCorrect="off"
          spellCheck={false}
          className="h-11 font-mono text-xs sm:h-9"
          aria-label="Preferência de modelo do Gemini — opcional, vazio usa os aliases automáticos"
          value={modelDraft}
          onChange={(e) => setModelDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
          }}
        />
        {/* AGORA EM USO — status curto do modelo, fora da gaveta. */}
        {modelLine ? <p className="text-[11px] text-muted-foreground">{modelLine}</p> : null}
      </div>

      {/* A EXPLICAÇÃO INTEIRA a um toque — recolhida para a tela não virar manual. */}
      <div className="mt-2">
        <InfoCollapse label="Como funciona a chave">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Cole a chave que você criou no AI Studio — ela vira <b>dado do dono</b> no servidor da
            casa e o tutor passa a usá-la antes das variáveis de ambiente. Se ela falhar ou estourar
            cota, o resto da cadeia (OpenRouter → Z.ai → elo local) assume sem drama.
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Aceita os dois formatos vivos do AI Studio — clássica{' '}
            <code className="rounded bg-muted px-1 font-mono text-[10px]">AIza…</code> e nova{' '}
            <code className="rounded bg-muted px-1 font-mono text-[10px]">AQ.…</code>. Aliases
            sugeridos (sobrevivem à troca de versão do Google; hoje apontam para a família 3.x,
            raciocínio HIGH por padrão):{' '}
            <code className="rounded bg-muted px-1 font-mono text-[10px]">
              gemini-flash-latest
            </code>{' '}
            ·{' '}
            <code className="rounded bg-muted px-1 font-mono text-[10px]">
              gemini-flash-lite-latest
            </code>
            .
          </p>
          <p className="flex items-start gap-1.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">
            <ShieldCheck className="mt-0.5 size-3 shrink-0" aria-hidden />
            a chave mora no servidor da casa como dado do usuário — nunca vai para o código nem para
            o git.
          </p>
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Cloud className="mt-0.5 size-3 shrink-0" aria-hidden />
            No deploy da Vercel, o banco do servidor é efêmero — lá a casa usa a variável de
            ambiente{' '}
            <code className="rounded bg-muted px-1 font-mono text-[10px]">GEMINI_API_KEY</code>{' '}
            (Settings → Environment Variables → redeploy). A cadeia lê a chave salva (aqui) → env
            (Vercel) → próximos elos.
          </p>
        </InfoCollapse>
      </div>
    </div>
  );
}

/** Switch do Modo Foco — hook próprio isola re-render do card inteiro. */
function FocusModeSwitch() {
  const [focusMode, setFocusMode] = useFocusMode();
  return (
    <Switch
      checked={focusMode}
      onCheckedChange={setFocusMode}
      aria-label="Ativar ou desativar o modo foco na navegação"
    />
  );
}

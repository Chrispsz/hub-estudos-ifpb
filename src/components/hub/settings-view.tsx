'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import {
  AppWindow,
  BellRing,
  CircleCheck,
  DatabaseBackup,
  Download,
  ExternalLink,
  Moon,
  RotateCcw,
  Settings2,
  ShieldAlert,
  Smartphone,
  Sun,
  Timer,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { usePwaInstall } from '@/components/pwa';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
      <h2 className="text-xl font-semibold">Configurações</h2>

      {/* ABAS (Task 221-b; Task 236 remove a casa "Tutor IA" — diagnóstico de
          chaves/modelos/limites era ruído que ninguém usa no dia a dia; a IA
          continua 100% funcional pela variável de ambiente no servidor):
          Aparência, Pomodoro e Dados. No toque, linha única 3 colunas com alvo
          mínimo de 44px; no desktop, a linha clássica. */}
      <Tabs defaultValue="aparencia" className="gap-4">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-lg p-1 md:inline-flex md:h-9 md:w-auto md:gap-0">
          <TabsTrigger value="aparencia" className="min-h-11 px-3 md:min-h-0">
            <Sun className="size-4" aria-hidden />
            Aparência
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

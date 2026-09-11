'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import {
  AppWindow,
  BellRing,
  DatabaseBackup,
  Download,
  Moon,
  RotateCcw,
  Settings2,
  Smartphone,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePwaInstall } from '@/components/pwa';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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

export function SettingsView() {
  const sp = useStudyProgress();
  const { theme, setTheme } = useTheme();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
      sp.replaceProgress(imported);
      toast.success('Progresso restaurado com sucesso!');
    };
    reader.onerror = () => toast.error('Não foi possível ler o arquivo.');
    reader.readAsText(file);
  }

  const pomodoroStats = {
    sessions: sp.progress.pomodoroSessions.length,
    minutes: sp.progress.pomodoroSessions.reduce((acc, s) => acc + s.focusMinutes, 0),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Configurações</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aparência, Pomodoro, backup e dados — tudo fica no seu navegador.
        </p>
      </div>

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
        </CardContent>
      </Card>

      {/* IA (OpenRouter) */}
      <AiInfoCard />

      {/* Instalar como app (PWA) */}
      <InstallAppCard />

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
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Foco (min)</p>
                <p className="text-xs text-muted-foreground">Duração de cada bloco</p>
              </div>
              <Input
                type="number"
                min={5}
                max={90}
                step={5}
                value={cfg.pomodoroConfig.focus}
                onChange={(e) =>
                  sp.updatePreferences({
                    pomodoroConfig: {
                      ...cfg.pomodoroConfig,
                      focus: Math.max(5, Math.min(90, Number(e.target.value) || 25)),
                    },
                  })
                }
                className="w-20 text-center"
                aria-label="Minutos de foco"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Pausa curta (min)</p>
                <p className="text-xs text-muted-foreground">Entre focos</p>
              </div>
              <Input
                type="number"
                min={1}
                max={30}
                value={cfg.pomodoroConfig.shortBreak}
                onChange={(e) =>
                  sp.updatePreferences({
                    pomodoroConfig: {
                      ...cfg.pomodoroConfig,
                      shortBreak: Math.max(1, Math.min(30, Number(e.target.value) || 5)),
                    },
                  })
                }
                className="w-20 text-center"
                aria-label="Minutos de pausa curta"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Pausa longa (min)</p>
                <p className="text-xs text-muted-foreground">A cada N ciclos</p>
              </div>
              <Input
                type="number"
                min={5}
                max={60}
                step={5}
                value={cfg.pomodoroConfig.longBreak}
                onChange={(e) =>
                  sp.updatePreferences({
                    pomodoroConfig: {
                      ...cfg.pomodoroConfig,
                      longBreak: Math.max(5, Math.min(60, Number(e.target.value) || 15)),
                    },
                  })
                }
                className="w-20 text-center"
                aria-label="Minutos de pausa longa"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Ciclos p/ pausa longa</p>
                <p className="text-xs text-muted-foreground">Focos antes da longa</p>
              </div>
              <Input
                type="number"
                min={2}
                max={8}
                value={cfg.pomodoroConfig.cyclesBeforeLong}
                onChange={(e) =>
                  sp.updatePreferences({
                    pomodoroConfig: {
                      ...cfg.pomodoroConfig,
                      cyclesBeforeLong: Math.max(2, Math.min(8, Number(e.target.value) || 4)),
                    },
                  })
                }
                className="w-20 text-center"
                aria-label="Ciclos antes da pausa longa"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Meta diária</p>
                <p className="text-xs text-muted-foreground">Pomodoros por dia</p>
              </div>
              <Input
                type="number"
                min={1}
                max={12}
                value={cfg.dailyGoal}
                onChange={(e) =>
                  sp.updatePreferences({
                    dailyGoal: Math.max(1, Math.min(12, Number(e.target.value) || 4)),
                  })
                }
                className="w-20 text-center"
                aria-label="Meta diária de pomodoros"
              />
            </div>
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
          </div>
        </CardContent>
      </Card>

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
            {pomodoroStats.sessions} sessões de Pomodoro ({pomodoroStats.minutes} min de foco
            acumulados) salvos no navegador. Exporte um JSON para não perder nada ao limpar o
            cache.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" className="justify-start" onClick={handleExport}>
              <Download className="size-4 text-emerald-500" />
              Exportar progresso (JSON)
            </Button>
            <Button
              variant="outline"
              className="justify-start"
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

      <Separator />

      {/* Sobre — versão mínima */}
      <p className="pb-2 text-center text-[11px] text-muted-foreground/70">
        Hub de Estudos IFPB v2.0 • dados 100% no seu navegador • IA via OpenRouter (modelos free)
      </p>
    </div>
  );
}

/** Informação da IA em uso (OpenRouter, modelos free com fallback automático). */
function AiInfoCard() {
  const [chains, setChains] = React.useState<{
    tutor: { id: string; label: string }[];
    flashcards: { id: string; label: string }[];
  } | null>(null);

  React.useEffect(() => {
    fetch('/api/tutor')
      .then((r) => r.json())
      .then((d) => d?.chains && setChains(d.chains))
      .catch(() => {});
  }, []);

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-violet-500" aria-hidden />
          Tutor IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          O tutor e o gerador de flashcards rodam em modelos <b>gratuitos</b> da OpenRouter com
          fallback automático: se um modelo atingir o limite diário, o próximo assume
          instantaneamente — sem erro para você.
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
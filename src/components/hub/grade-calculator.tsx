'use client';

import * as React from 'react';
import {
  Calculator,
  CheckCircle2,
  ClipboardList,
  Eraser,
  Plus,
  RotateCcw,
  Save,
  Scale,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  disciplines,
  evaluationPeriods,
  getDisciplineByCode,
  type Discipline,
} from '@/data/course-data';
import {
  calcGrade,
  formatNote,
  statusColor,
  statusLabel,
} from '@/lib/grade-calc';
import { useStudyProgress } from '@/lib/study-progress';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { daysUntilDate } from '@/lib/semester';

export function GradeCalculator() {
  const sp = useStudyProgress();
  const [code, setCode] = React.useState(disciplines[0].code);
  const [notes, setNotes] = React.useState<{ [k: string]: number | null }>({});
  const [af, setAf] = React.useState<number | null>(null);

  const discipline = React.useMemo<Discipline>(
    () => disciplines.find((d) => d.code === code) as Discipline,
    [code],
  );

  // Carrega notas salvas do localStorage ao trocar de disciplina
  React.useEffect(() => {
    const saved = sp.progress.gradeNotes[code] ?? {};
    const next: { [k: string]: number | null } = {};
    for (const c of discipline.gradeComponents) {
      next[c.name] = saved[c.name] != null ? saved[c.name] : null;
    }
    setNotes(next);
    setAf(null);
  }, [code, discipline.gradeComponents, sp.progress.gradeNotes]);

  const result = React.useMemo(
    () => calcGrade(discipline, notes as { [k: string]: number }, af ?? undefined),
    [discipline, notes, af],
  );

  function handleSave() {
    for (const c of discipline.gradeComponents) {
      const v = notes[c.name];
      if (v != null && !Number.isNaN(v)) {
        sp.saveGradeNote(code, c.name, v);
      }
    }
    if (af != null && !Number.isNaN(af)) {
      sp.saveGradeNote(code, '__af__', af);
    }
    toast.success('Notas salvas no seu navegador.');
  }

  function handleReset() {
    const next: { [k: string]: number | null } = {};
    for (const c of discipline.gradeComponents) {
      next[c.name] = null;
    }
    setNotes(next);
    setAf(null);
    sp.resetGradeNotes(code);
    toast.success('Notas resetadas.');
  }

  // Histórico: todas as disciplinas com notas salvas
  const history = React.useMemo(() => {
    return disciplines
      .map((d) => {
        const saved = sp.progress.gradeNotes[d.code];
        if (!saved || Object.keys(saved).length === 0) return null;
        const filled: { [k: string]: number } = {};
        for (const c of d.gradeComponents) {
          const v = saved[c.name];
          if (v != null) filled[c.name] = v;
        }
        const afSaved = saved['__af__'];
        const r = calcGrade(d, filled, afSaved);
        return { discipline: d, result: r, saved, afSaved };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [sp.progress.gradeNotes]);

  function setNote(name: string, value: string) {
    const v = value === '' ? null : parseFloat(value.replace(',', '.'));
    setNotes((prev) => ({ ...prev, [name]: v }));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Calculadora de médias</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione uma disciplina, digite suas notas e veja automaticamente a situação.
          Tudo é salvo no seu navegador.
        </p>
      </div>

      {/* Selecionar disciplina */}
      <Card className="rounded-xl p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <Label className="text-xs">Disciplina</Label>
            <Select value={code} onValueChange={setCode}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {disciplines.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleSave} className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Save className="size-3.5" /> Salvar notas
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset}>
              <RotateCcw className="size-3.5" /> Resetar
            </Button>
          </div>
        </div>
      </Card>

      {/* Método de avaliação */}
      <Card className="rounded-xl p-4 shadow-sm">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Scale className="size-4 text-violet-500" /> Método de avaliação
        </h3>
        <p className="text-sm text-foreground/85">{discipline.avaliacao}</p>
        {discipline.criteriosAprovacao && (
          <p className="mt-1 text-xs text-muted-foreground">
            {discipline.criteriosAprovacao}
          </p>
        )}
        {discipline.finalExamFormula && (
          <p className="mt-2 inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-900">
            <Calculator className="size-3" />
            <code className="font-mono">{discipline.finalExamFormula}</code>
          </p>
        )}
      </Card>

      {/* Inputs dos componentes */}
      <Card className="rounded-xl p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Calculator className="size-4 text-emerald-500" /> Componentes da nota
        </h3>
        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Componente</TableHead>
                <TableHead className="w-16 text-right">Peso</TableHead>
                <TableHead className="w-32">Nota (0-{discipline.scale})</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discipline.gradeComponents.map((c) => (
                <TableRow key={c.name}>
                  <TableCell>
                    <span className="font-medium">{c.name}</span>
                    <p className="text-[11px] text-muted-foreground">{c.description}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.weight}%</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={c.scale}
                      step={c.scale === 10 ? 0.1 : 0.5}
                      placeholder={`0 a ${c.scale}`}
                      value={notes[c.name] ?? ''}
                      onChange={(e) => setNote(c.name, e.target.value)}
                      className="h-8"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* AF (somente se MS entre finalThreshold e approvalThreshold) */}
      {result.needsFinal && (
        <Card className="rounded-xl border-l-4 border-l-amber-500 p-4 shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700">
            <AlertTriangle className="size-4" /> Avaliação Final (AF)
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Sua MS está entre {discipline.finalExamThreshold} e {discipline.approvalThreshold}.
            Informe sua nota na AF para calcular a MF.
          </p>
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nota AF (0-{discipline.scale})</Label>
              <Input
                type="number"
                min={0}
                max={discipline.scale}
                step={discipline.scale === 10 ? 0.1 : 0.5}
                value={af == null ? '' : af}
                onChange={(e) =>
                  setAf(e.target.value === '' ? null : parseFloat(e.target.value.replace(',', '.')))
                }
                className="h-8 w-32"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Fórmula: <code className="font-mono">{discipline.finalExamFormula}</code>
            </p>
          </div>
        </Card>
      )}

      {/* Resultado */}
      <Card
        className={cn(
          'rounded-2xl border-l-4 p-5 shadow-sm',
          result.status === 'aprovado'
            ? 'border-l-emerald-500 bg-emerald-50'
            : result.status === 'final'
              ? 'border-l-amber-500 bg-amber-50'
              : result.status === 'reprovado'
                ? 'border-l-rose-500 bg-rose-50'
                : 'border-l-slate-500 bg-muted/30',
        )}
      >
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Situação
            </p>
            <p className={cn('mt-1 text-2xl font-bold', statusColor(result))}>
              {statusLabel(result)}
            </p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-xs text-muted-foreground">MS (média semestre)</p>
              <p className="text-xl font-bold tabular-nums">
                {formatNote(result.ms, result.scale)}
              </p>
            </div>
            {result.mf != null && (
              <div>
                <p className="text-xs text-muted-foreground">MF (com AF)</p>
                <p className="text-xl font-bold tabular-nums">
                  {formatNote(result.mf, result.scale)}
                </p>
              </div>
            )}
          </div>
          <div className="shrink-0">
            {result.status === 'aprovado' && (
              <TrendingUp className="size-8 text-emerald-600" />
            )}
            {result.status === 'final' && (
              <AlertTriangle className="size-8 text-amber-600" />
            )}
            {result.status === 'reprovado' && (
              <TrendingDown className="size-8 text-rose-600" />
            )}
          </div>
        </div>
      </Card>

      {/* Histórico de notas salvas */}
      <Card className="rounded-xl p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="size-4 text-emerald-500" /> Histórico de notas salvas
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma nota salva ainda. Preencha os componentes e clique em &quot;Salvar notas&quot;.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {history.map(({ discipline: d, result: r, saved, afSaved }) => (
              <li
                key={d.code}
                className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{d.shortName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    MS: {formatNote(r.ms, d.scale)}
                    {r.mf != null ? ` • MF: ${formatNote(r.mf, d.scale)}` : ''}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'border text-[10px]',
                    r.status === 'aprovado'
                      ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                      : r.status === 'final'
                        ? 'border-amber-200 bg-amber-100 text-amber-700'
                        : r.status === 'reprovado'
                          ? 'border-rose-200 bg-rose-100 text-rose-700'
                          : 'border-slate-200 bg-slate-50 text-slate-700',
                  )}
                >
                  {statusLabel(r)}
                </Badge>
                <button
                  onClick={() => sp.resetGradeNotes(d.code)}
                  className="text-muted-foreground hover:text-rose-600"
                  aria-label="Limpar notas desta disciplina"
                >
                  <Eraser className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* V3 — Notas reais das avaliações */}
      <RealGradesSection />
    </div>
  );
}

// ============= V3 — Notas Reais =============
function RealGradesSection() {
  const sp = useStudyProgress();
  const [addCustomOpen, setAddCustomOpen] = React.useState(false);

  // Lista todas as avaliações (padrão + customizadas)
  const allEvaluations = React.useMemo(() => {
    const standard = evaluationPeriods.map((e) => ({
      key: `${e.disciplineCode}-${e.evaluationName}`,
      disciplineCode: e.disciplineCode,
      name: e.evaluationName,
      description: e.description,
      date: e.date as string | undefined,
      isCustom: false,
      customDate: undefined as string | undefined,
    }));
    const custom = sp.progress.customEvaluations.map((c) => ({
      key: `custom-${c.id}`,
      disciplineCode: c.disciplineCode,
      name: c.name,
      description: c.description,
      date: undefined as string | undefined,
      isCustom: true,
      customDate: c.date,
    }));
    return [...standard, ...custom];
  }, [sp.progress.customEvaluations]);

  // Resumo: média real vs alvo por disciplina
  const summaryByDiscipline = React.useMemo(() => {
    const map = new Map<string, { real: number[]; target: number }>();
    for (const d of disciplines) {
      map.set(d.code, { real: [], target: d.approvalThreshold });
    }
    for (const ev of allEvaluations) {
      const gradeEntry = sp.progress.realGrades[ev.key];
      if (gradeEntry) {
        const arr = map.get(ev.disciplineCode)?.real ?? [];
        // Normaliza para 100
        const disc = getDisciplineByCode(ev.disciplineCode);
        const scale = disc?.scale === 10 ? 10 : 100;
        const normalized = scale === 10 ? gradeEntry.grade * 10 : gradeEntry.grade;
        arr.push(normalized);
        if (map.has(ev.disciplineCode)) {
          map.get(ev.disciplineCode)!.real = arr;
        }
      }
    }
    return Array.from(map.entries()).map(([code, v]) => {
      const avg = v.real.length === 0 ? 0 : v.real.reduce((a, b) => a + b, 0) / v.real.length;
      return { code, realAvg: avg, target: v.target, count: v.real.length };
    });
  }, [allEvaluations, sp.progress.realGrades]);

  const totalDone = Object.keys(sp.progress.realGrades).length;
  const totalEvals = allEvaluations.length;

  function setRealGrade(key: string, value: string, scale: 10 | 100) {
    const v = parseFloat(value.replace(',', '.'));
    if (Number.isNaN(v)) {
      sp.removeRealGrade(key);
      return;
    }
    if (v < 0 || v > scale) {
      toast.error(`Nota deve estar entre 0 e ${scale}`);
      return;
    }
    sp.saveRealGrade(key, v);
  }

  return (
    <Card className="rounded-xl p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="size-4 text-emerald-500" /> Minhas notas reais
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">
            {totalDone}/{totalEvals} lançadas
          </Badge>
          <Button size="sm" variant="outline" onClick={() => setAddCustomOpen(true)}>
            <Plus className="size-3.5" /> Avaliação extra
          </Button>
        </div>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Registre as notas reais das avaliações que você já fez. Compare com a média alvo e veja sua situação real.
      </p>

      <div className="overflow-hidden rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Disciplina</TableHead>
              <TableHead>Avaliação</TableHead>
              <TableHead className="w-20 text-right">Quando</TableHead>
              <TableHead className="w-28">Nota real</TableHead>
              <TableHead className="w-20 text-right">Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allEvaluations.map((ev) => {
              const disc = getDisciplineByCode(ev.disciplineCode);
              const color = getColorClassesByCode(ev.disciplineCode);
              const gradeEntry = sp.progress.realGrades[ev.key];
              const scale = disc?.scale ?? 100;
              const days = ev.date
                ? daysUntilDate(ev.date)
                : ev.customDate
                  ? Math.ceil((new Date(ev.customDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
                  : null;
              const isDone = !!gradeEntry;
              const target = disc?.approvalThreshold ?? 70;
              const normalized = gradeEntry && scale === 10 ? gradeEntry.grade * 10 : gradeEntry?.grade;
              const passed = normalized != null && normalized >= target;
              return (
                <TableRow key={ev.key} className={cn(isDone && 'bg-emerald-50/30')}>
                  <TableCell>
                    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', color.text)}>
                      <span className={cn('size-2 rounded-full', color.dot)} />
                      {disc?.shortName ?? ev.disciplineCode}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-semibold">{ev.name}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{ev.description}</p>
                  </TableCell>
                  <TableCell className="text-right text-[11px] text-muted-foreground">
                    {ev.isCustom && ev.customDate
                      ? new Date(ev.customDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                      : ev.date
                        ? new Date(`${ev.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                        : days != null
                          ? days > 0
                            ? `${days}d`
                            : days === 0
                              ? 'hoje'
                              : 'feita'
                          : '—'}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={scale}
                      step={scale === 10 ? 0.1 : 0.5}
                      placeholder={`0-${scale}`}
                      value={gradeEntry?.grade ?? ''}
                      onChange={(e) => setRealGrade(ev.key, e.target.value, scale)}
                      className="h-8 w-24"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {!isDone ? (
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600 text-[9px]">
                        pendente
                      </Badge>
                    ) : passed ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-700 text-[9px]">
                        ✓ ok
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-rose-200 bg-rose-100 text-rose-700 text-[9px]">
                        abaixo
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Resumo por disciplina */}
      {totalDone > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Média real por disciplina</p>
          {summaryByDiscipline
            .filter((s) => s.count > 0)
            .map((s) => {
              const disc = getDisciplineByCode(s.code);
              const color = getColorClassesByCode(s.code);
              const passed = s.realAvg >= s.target;
              return (
                <div key={s.code} className="flex items-center gap-2 text-xs">
                  <span className={cn('size-2 rounded-full', color.dot)} />
                  <span className="w-28 shrink-0 font-medium">{disc?.shortName ?? s.code}</span>
                  <span className="tabular-nums">{formatNote(s.realAvg, 100)}</span>
                  <span className="text-muted-foreground">/ alvo {s.target}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'border text-[9px]',
                      passed
                        ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                        : 'border-rose-200 bg-rose-100 text-rose-700',
                    )}
                  >
                    {passed ? 'acima' : 'abaixo'}
                  </Badge>
                  <span className="ml-auto text-[10px] text-muted-foreground">{s.count} nota(s)</span>
                </div>
              );
            })}
        </div>
      )}

      {/* Próxima prova baseada nas notas já feitas */}
      <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-900">
        <p className="font-semibold">Próxima prova:</p>
        <p className="mt-0.5">
          {(() => {
            const done = new Set(Object.keys(sp.progress.realGrades).map((k) => k));
            const next = allEvaluations.find(
              (e) => !done.has(e.key) && e.date && daysUntilDate(e.date) > 0,
            );
            if (!next) return 'Nenhuma data oficial à frente (demais avaliações: aguarde divulgação ou adicione uma customizada).';
            const disc = getDisciplineByCode(next.disciplineCode);
            const days = daysUntilDate(next.date!);
            const when = new Date(`${next.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            return `${disc?.shortName} • ${next.name} — ${when} (em ${days} dias)`;
          })()}
        </p>
      </div>

      <AddCustomEvaluationDialog open={addCustomOpen} onOpenChange={setAddCustomOpen} />
    </Card>
  );
}

function getColorClassesByCode(code: string) {
  const disc = getDisciplineByCode(code);
  return getColorClassesByDiscipline(disc);
}

function getColorClassesByDiscipline(disc: ReturnType<typeof getDisciplineByCode>) {
  if (!disc) {
    return {
      dot: 'bg-slate-500',
      text: 'text-slate-700',
    };
  }
  const colorMap: Record<string, { dot: string; text: string }> = {
    emerald: { dot: 'bg-emerald-500', text: 'text-emerald-700' },
    orange: { dot: 'bg-orange-500', text: 'text-orange-700' },
    rose: { dot: 'bg-rose-500', text: 'text-rose-700' },
    violet: { dot: 'bg-violet-500', text: 'text-violet-700' },
    amber: { dot: 'bg-amber-500', text: 'text-amber-700' },
    teal: { dot: 'bg-teal-500', text: 'text-teal-700' },
    cyan: { dot: 'bg-cyan-500', text: 'text-cyan-700' },
  };
  return colorMap[disc.color] ?? { dot: 'bg-slate-500', text: 'text-slate-700' };
}

function AddCustomEvaluationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const sp = useStudyProgress();
  const [discipline, setDiscipline] = React.useState(disciplines[0].code);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [date, setDate] = React.useState('');
  const [scale, setScale] = React.useState<string>('100');

  function submit() {
    if (!name.trim()) {
      toast.error('Informe o nome da avaliação');
      return;
    }
    sp.addCustomEvaluation({
      disciplineCode: discipline,
      name: name.trim(),
      description: description.trim() || 'Avaliação extra',
      date: date || new Date().toISOString().slice(0, 10),
      weight: 100,
      scale: scale === '10' ? 10 : 100,
    });
    toast.success('Avaliação extra adicionada!');
    onOpenChange(false);
    setName('');
    setDescription('');
    setDate('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar avaliação extra</DialogTitle>
          <DialogDescription>
            Adicione um trabalho, seminário ou avaliação extra para acompanhar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Disciplina</Label>
            <Select value={discipline} onValueChange={setDiscipline}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {disciplines.map((d) => (
                  <SelectItem key={d.code} value={d.code}>{d.shortName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome da avaliação</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Trabalho extra" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Trabalho sobre ..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Escala</Label>
              <Select value={scale} onValueChange={setScale}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">0-100</SelectItem>
                  <SelectItem value="10">0-10</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={submit} className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Plus className="size-3.5" /> Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

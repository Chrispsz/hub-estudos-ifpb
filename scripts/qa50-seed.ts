/**
 * QA 50 — seed do caderno de erros (1 corrida com 1 missed em Matrizes).
 * JS compacto em UMA linha com aspas duplas no corpo (o wrapper do shell usa
 * aspas simples) — evita o problema de quoting do multi-linha.
 */
import { execSync } from 'node:child_process';

const js = [
  '(() => {',
  'const K="hub-estudos-ifpb:v2";',
  'const d=JSON.parse(localStorage.getItem(K)||"{}");',
  'const run={id:"qa50-run",date:new Date(Date.now()-7200000).toISOString(),total:5,solved:4,missed:1,skipped:0,durationSec:600,filters:{discipline:"TEC.1984"},questions:[' +
    '{status:"missed",disciplineCode:"TEC.1984",topic:"Matrizes",difficulty:"medio",statement:"Dada A = [[1,2],[3,4]], calcule A ao quadrado e verifique se A e inversivel."},' +
    '{status:"solved",disciplineCode:"TEC.1984",topic:"Lógica",difficulty:"facil"},' +
    '{status:"solved",disciplineCode:"TEC.1984",topic:"Matrizes",difficulty:"medio"},' +
    '{status:"solved",disciplineCode:"TEC.1984",topic:"Matrizes",difficulty:"facil"},' +
    '{status:"solved",disciplineCode:"TEC.1984",topic:"Matrizes",difficulty:"facil"}]};',
  'd.simuladoRuns=[run];',
  'localStorage.setItem(K,JSON.stringify(d));',
  'return "seeded ok: 1 corrida, 1 missed Matrizes";',
  '})()',
].join('');

const out = execSync(`agent-browser eval '${js}'`, { encoding: 'utf8', shell: '/bin/bash' });
console.log(out.trim());

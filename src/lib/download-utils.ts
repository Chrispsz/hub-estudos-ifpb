'use client';

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { materials, type Material } from '@/data/course-data';

/**
 * Faz fetch de um PDF/PNG/arquivo estático como ArrayBuffer.
 * Em deploy (Vercel) basta servir os PDFs da pasta /public.
 */
async function fetchFile(path: string): Promise<ArrayBuffer> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Falha ao baixar ${path}: ${res.status}`);
  return res.arrayBuffer();
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w\u00C0-\u017F\-\. ]+/g, '_').trim();
}

/**
 * Baixa um único PDF (link direto).
 */
export function downloadPdf(pdfPath: string, filename: string): void {
  // Link direto funciona melhor para PDFs grandes (não carrega tudo na memória)
  const a = document.createElement('a');
  a.href = pdfPath;
  a.download = sanitizeFileName(filename);
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Gera um ZIP com todos os PDFs de uma disciplina (inclui ementa).
 * @param disciplineCode código da disciplina
 * @param onProgress callback 0-100
 */
export async function downloadDisciplineZip(
  disciplineCode: string,
  disciplineName: string,
  onProgress?: (p: number) => void,
): Promise<void> {
  const mats = materials.filter(
    (m) => m.disciplineCode === disciplineCode && m.pdfPath,
  );
  if (mats.length === 0) throw new Error('Sem PDFs para esta disciplina.');
  await zipMaterials(mats, `${sanitizeFileName(disciplineName)}.zip`, onProgress);
}

/**
 * Gera um ZIP com TODOS os PDFs do projeto.
 */
export async function downloadAllZip(
  onProgress?: (p: number) => void,
): Promise<void> {
  const mats = materials.filter((m) => m.pdfPath);
  await zipMaterials(mats, 'hub-estudos-ifpb-pdfs.zip', onProgress);
}

/**
 * Gera um ZIP com todos os resumos IA (JSONs).
 */
export async function downloadSummariesZip(
  onProgress?: (p: number) => void,
): Promise<void> {
  const mats = materials.filter((m) => m.summaryFile);
  const zip = new JSZip();
  let done = 0;
  for (const m of mats) {
    try {
      const res = await fetch(`/data/ai-summaries/${m.summaryFile}`);
      if (!res.ok) continue;
      const json = await res.text();
      zip.file(`${m.id}.summary.json`, json);
    } catch {
      // ignore
    }
    done += 1;
    onProgress?.(Math.round((done / mats.length) * 100));
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, 'resumos-ia.zip');
  onProgress?.(100);
}

async function zipMaterials(
  mats: Material[],
  zipName: string,
  onProgress?: (p: number) => void,
): Promise<void> {
  const zip = new JSZip();
  let done = 0;
  for (const m of mats) {
    if (!m.pdfPath) continue;
    try {
      const buf = await fetchFile(m.pdfPath);
      const filename = m.pdfPath.split('/').pop() ?? `${m.id}.pdf`;
      zip.file(filename, buf);
    } catch {
      // ignore individual failures
    }
    done += 1;
    onProgress?.(Math.round((done / mats.length) * 100));
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, zipName);
  onProgress?.(100);
}

/**
 * Estima o tamanho total dos PDFs de uma lista.
 * (Retorna uma string humanizada.)
 */
export async function estimateTotalSize(mats: Material[]): Promise<string> {
  let total = 0;
  for (const m of mats) {
    if (!m.pdfPath) continue;
    try {
      const res = await fetch(m.pdfPath, { method: 'HEAD' });
      const len = Number(res.headers.get('Content-Length') || 0);
      if (len > 0) total += len;
    } catch {
      // ignore
    }
  }
  if (total === 0) return '—';
  if (total < 1024 * 1024) return `${(total / 1024).toFixed(0)} KB`;
  return `${(total / (1024 * 1024)).toFixed(1)} MB`;
}

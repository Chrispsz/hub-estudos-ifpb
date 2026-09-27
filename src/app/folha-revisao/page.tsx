import type { Metadata } from 'next';
import { FolhaRevisaoSheet } from '@/components/hub/folha-revisao-sheet';

export const metadata: Metadata = {
  title: 'Folha de Revisão — Av1 Matemática | Hub de Estudos IFPB',
  description:
    'Fórmulas essenciais, foco do simulado, checklist de domínio, plano da véspera e kit do dia da prova — uma folha para imprimir e levar na mochila.',
};

export default function FolhaRevisaoPage() {
  return <FolhaRevisaoSheet />;
}

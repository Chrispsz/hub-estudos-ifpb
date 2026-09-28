import type { Metadata } from 'next';
import { CadernoPapelSheet } from '@/components/hub/caderno-papel-sheet';

export const metadata: Metadata = {
  title: 'Caderno de Erros no Papel | Hub de Estudos IFPB',
  description:
    'As questões pendentes do Caderno de Erros com enunciado completo, numeradas e com espaço de trabalho — uma folha para imprimir e refazer no papel.',
};

export default function CadernoPapelPage() {
  return <CadernoPapelSheet />;
}

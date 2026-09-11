import {
  Code2,
  FileCode2,
  Sigma,
  Cpu,
  Users,
  Languages,
  BookOpen,
  type LucideProps,
} from 'lucide-react';

export const iconMap: Record<string, React.FC<LucideProps>> = {
  Code2,
  FileCode2,
  Sigma,
  Cpu,
  Users,
  Languages,
  BookOpen,
};

export function getIcon(name: string): React.FC<LucideProps> {
  return iconMap[name] ?? BookOpen;
}

// Componente estável para uso direto em JSX (evita o lint rule
// "react-hooks/static-components" de reclamar de componentes criados em render).
export function DisciplineIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = iconMap[name] ?? BookOpen;
  return <Icon className={className} />;
}

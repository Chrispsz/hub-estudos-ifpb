import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { PwaRegister } from '@/components/pwa';
import {
  CURRENT_PERIOD,
  CURRENT_PERIOD_LABEL,
  CURRENT_PERIOD_LOWER,
  CURRENT_TURMA_LOWER,
  CURRENT_TURMA_LABEL,
} from '@/lib/curriculum';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap', // next/font já auto-hospeda (sem FOUT de CDN); swap evita texto invisível
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: `Hub de Estudos • IFPB ADS — Turma ${CURRENT_TURMA_LABEL}`,
  description:
    `Hub de estudos do ${CURRENT_PERIOD_LOWER} (${CURRENT_TURMA_LABEL}, IFPB Campus Cajazeiras) — disciplinas, biblioteca, cronograma inteligente rotativo, Pomodoro com continuidade e tutor IA.`,
  keywords: [
    'IFPB',
    'ADS',
    'Análise e Desenvolvimento de Sistemas',
    'Cajazeiras',
    `${CURRENT_PERIOD}º período`,
    CURRENT_TURMA_LABEL,
    'estudos',
    'Pomodoro',
    'cronograma',
    'IA',
  ],
  authors: [{ name: 'Hub de Estudos IFPB' }],
  openGraph: {
    locale: 'pt_BR',
    type: 'website',
    siteName: 'Hub de Estudos IFPB',
    title: `Hub de Estudos • IFPB ADS — Turma ${CURRENT_TURMA_LABEL}`,
    description:
      `Disciplinas, biblioteca, cronograma inteligente, Pomodoro e tutor IA para o ${CURRENT_PERIOD_LOWER} (${CURRENT_TURMA_LABEL}, IFPB Campus Cajazeiras).`,
  },
  icons: {
    icon: '/logo-ifpb.svg',
    apple: '/icons/apple-touch-icon.png',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Hub IFPB',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  // Cor do tema na barra do navegador, por esquema de cor do sistema.
  // (O tema do app é alternável via next-themes; a media query cobre o padrão do SO.)
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0c0c' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <PwaRegister />
          {/* visibleToasts=2: evita pilha de notificações cobrindo a tela;
              as demais ficam em fila e aparecem conforme as visíveis somem. */}
          <Toaster position="top-right" richColors closeButton visibleToasts={2} />
        </ThemeProvider>
      </body>
    </html>
  );
}

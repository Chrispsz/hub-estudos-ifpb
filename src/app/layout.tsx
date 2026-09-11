import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { PwaRegister } from '@/components/pwa';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Hub de Estudos • IFPB ADS 2026.2',
  description:
    'Hub de estudos do 2º período de Análise e Desenvolvimento de Sistemas (IFPB Campus Cajazeiras, 2026.2) — disciplinas, biblioteca, cronograma inteligente rotativo, Pomodoro com continuidade e tutor IA.',
  keywords: [
    'IFPB',
    'ADS',
    'Análise e Desenvolvimento de Sistemas',
    'Cajazeiras',
    '2º período',
    'estudos',
    'Pomodoro',
    'cronograma',
    'IA',
  ],
  authors: [{ name: 'Hub de Estudos IFPB' }],
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
  themeColor: '#0c0c0c',
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
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}

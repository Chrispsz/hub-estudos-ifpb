'use client';

import * as React from 'react';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      {/* reducedMotion="user": usuários com prefers-reduced-motion no SO deixam de
          ver animações de transform do framer-motion (opacity continua, sem
          quebrar nada para quem não ativa a preferência). */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </NextThemesProvider>
  );
}

# Override: Home (Hub de Estudos IFPB)

> Este arquivo **sobrepõe o MASTER.md** para a home do app.
> Motivo: o app já possui identidade visual consolidada (shadcn/ui New York + next-themes,
> dark-first). O MASTER.md é referência de princípios; os tokens reais abaixo mandam.

## Identidade real (não regredir)

- **Tema**: dark-first com light mode via `next-themes` (tokens shadcn semânticos em
  `src/app/globals.css` — OKLCH). Nunca hex cru em componentes.
- **Primária atual**: teal/emerald (`bg-primary` teal-600 em dark). Sem indigo/azul —
  regra do projeto. O MASTER.md (teal #0D9488 + laranja de ação) é compatível em espírito.
- **Tipografia**: Geist Sans/Mono (Next.js font), não Plus Jakarta Sans. O par do MASTER.md
  fica registrado como alternativa caso um dia o produto migre para landing/marketing.
- **Ícones**: exclusivamente Lucide (SVG). Zero emoji como ícone.

## Regras herdadas do MASTER.md que se aplicam à home

1. **Acessibilidade**: contraste 4.5:1, foco visível, `prefers-reduced-motion` respeitado.
2. **Toque**: alvos ≥ 44px, espaçamento ≥ 8px entre ações.
3. **Performance**: sem CLS em chips/cards (reservar altura), transições 150–200ms ease.
4. **Anti-padrões**: sem emoji-ícone, sem onboarding complexo, sem performance lenta.
5. **Checklist pré-entrega** do MASTER.md vale para toda PR de UI.

## Fluxo canônico da home (contexto de uso)

A home é **um fluxo único**: "Bom estudo." → ritmo do dia → "Iniciar meu dia" → blocos.
Não duplicar chamadas para ação concorrentes (lição da M15).

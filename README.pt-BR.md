# 🎓 Hub de Estudos — IFPB ADS 2026.2

App de estudos pessoal para o 2º período de **Análise e Desenvolvimento de Sistemas** no IFPB Campus Cajazeiras (2026.2) — construído em Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui.

## ✨ O que tem dentro

- **Dashboard** com semana atual do semestre, agenda acadêmica oficial e próximas avaliações **com data oficial** (política anti-estimativa: sem data divulgada = "data a confirmar", nunca um prazo inventado)
- **7 disciplinas** com materiais, tópicos de estudo, progresso por item e PDFs integrados (visualizador com tutor IA embutido)
- **Tutor IA** em PT-BR (`/api/tutor`) via OpenRouter com cadeia de modelos gratuitos + fallback — responde com base no contexto real do app (professor, datas oficiais, progresso do aluno)
- **Flashcards** gerados por IA com revisão espaçada
- **Pomodoro**, **exercícios interativos em C**, **mapa de tópicos** e **timeline do semestre**
- PWA: instalável, com service worker e manifest

## 🧠 Política de dados

- Todo o progresso do aluno (materiais, tópicos, pomodoro, flashcards) fica **no navegador** (localStorage) — sem cadastro, sem servidor de dados.
- O tutor só usa **datas oficiais** enviadas pelo front. Avaliações sem data divulgada nunca recebem prazo estimado.

## 🚀 Rodando localmente

```bash
# 1. instale as dependências (npm, pnpm ou bun)
bun install

# 2. configure a chave do tutor
echo 'OPENROUTER_API_KEY=sua_chave' > .env

# 3. rode
bun run dev
```

> A chave `OPENROUTER_API_KEY` (ou `ZAI_API_KEY` — veja a seção abaixo) é opcional para o app funcionar, mas obrigatória para o tutor IA responder fora do ambiente de desenvolvimento.

## 🔑 Colocando o Tutor IA no ar (1 chave gratuita, 2 minutos)

O tutor funciona com **UMA** das duas opções abaixo — escolha a que preferir. Nenhuma delas interfere em contas existentes: são chaves suas, novas e gratuitas.

### Opção A — OpenRouter (recomendado)

1. Crie conta grátis em [openrouter.ai](https://openrouter.ai) → *Keys* → *Create Key*
2. Adicione nas variáveis de ambiente (local `.env` + Vercel):

   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   ```

   Acesso a dezenas de modelos gratuitos (a cadeia já usa Nemotron, Nex, Ling e mais — sem custo).

### Opção B — API pública Z.ai (GLM)

1. Crie conta em [z.ai](https://z.ai) (ou [bigmodel.cn](https://bigmodel.cn)) e gere sua API key
2. Adicione nas variáveis de ambiente:

   ```
   ZAI_API_KEY=sua_chave
   # opcionais:
   ZAI_BASE_URL=https://api.z.ai/api/paas/v4
   ZAI_MODEL=glm-4.5-flash
   ```

   O modelo `glm-4.5-flash` tem **tier gratuito** com limites generosos — ideal para o tutor.

> ℹ️ Sem nenhuma chave, o tutor ainda tenta o SDK Z-AI embutido, que **só funciona em desenvolvimento** (depende de credencial interna do ambiente sandbox). Em produção (Vercel) ele é ignorado silenciosamente — por isso uma chave acima é necessária.

## ▲ Deploy na Vercel

O projeto é 100% compatível com a Vercel — Next.js 16 App Router, sem banco em runtime, sem serviços externos além da OpenRouter:

1. **Importe o repositório** em [vercel.com/new](https://vercel.com/new) (framework detectado: Next.js, build `next build`, nada para ajustar).
2. **Adicione a variável de ambiente** em *Settings → Environment Variables* (Opção A ou B acima):

   | Nome | Valor | Ambientes |
   | --- | --- | --- |
   | `OPENROUTER_API_KEY` | sua chave da [openrouter.ai/keys](https://openrouter.ai/keys) | Production, Preview, Development |
   | *ou* `ZAI_API_KEY` | sua chave da [z.ai](https://z.ai) | Production, Preview, Development |

3. **Deploy.** Pronto — o tutor responde pela cadeia de modelos gratuitos.

### Notas técnicas

- `next.config.ts` usa `output: "standalone"` — a Vercel lida com isso nativamente.
- `prisma/` + SQLite estão presentes como scaffold opcional; **nada no runtime os utiliza** e nenhuma configuração de banco é necessária.
- Os PDFs das disciplinas e dados do curso são estáticos em `public/` e `src/data/`.

## 🗂️ Estrutura principal

```
src/
├── app/
│   ├── page.tsx            # App principal (client-side)
│   └── api/tutor/          # Tutor IA + flashcards (OpenRouter + fallback)
├── components/hub/         # Dashboard, disciplinas, PDF viewer, tutor, pomodoro…
├── data/course-data.ts     # Disciplinas, professores, avaliações com data oficial
├── lib/                    # semester.ts (calendário), tutor-context.ts, progresso…
└── public/pdfs/            # Materiais oficiais das disciplinas
```

---

Feito com 💚 para a turma de ADS — IFPB Campus Cajazeiras.

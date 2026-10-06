# 🎓 Study Hub — IFPB ADS 2026.2

> **[Versão em português](README.pt-BR.md)**

Personal study app for the 2nd term of **Systems Analysis and Development** at IFPB Campus Cajazeiras (2026.2) — built with Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui.

## ✨ What's inside

- **Dashboard** with the current semester week, official academic agenda and upcoming exams **with official dates** (anti-estimation policy: no disclosed date = "date to be confirmed", never an invented deadline)
- **7 courses** with materials, study topics, per-item progress and built-in PDFs (viewer with an embedded AI tutor)
- **AI tutor** (`/api/tutor`) via OpenRouter with a chain of free models + fallback — answers based on the app's real context (professor, official dates, student progress)
- **AI-generated flashcards** with spaced repetition
- **Pomodoro**, **interactive C exercises**, **topic map** and **semester timeline**
- PWA: installable, with service worker and manifest

## 🧠 Data policy

- All student progress (materials, topics, pomodoro, flashcards) stays **in the browser** (localStorage) — no signup, no data server.
- The tutor only uses **official dates** sent by the front end. Exams without a disclosed date never get an estimated deadline.

## 🚀 Running locally

```bash
# 1. install dependencies (npm, pnpm or bun)
bun install

# 2. set the tutor key
echo 'OPENROUTER_API_KEY=your_key' > .env

# 3. run
bun run dev
```

> The `OPENROUTER_API_KEY` (or `ZAI_API_KEY` — see below) is optional for the app to work, but required for the AI tutor to answer outside the development environment.

## 🔑 Bringing the AI tutor online (1 free key, 2 minutes)

The tutor works with **ONE** of the two options below — pick whichever you prefer. Neither interferes with existing accounts: they are your own, new and free keys.

### Option A — OpenRouter (recommended)

1. Create a free account at [openrouter.ai](https://openrouter.ai) → *Keys* → *Create Key*
2. Add it to the environment variables (local `.env` + Vercel):

   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   ```

   Access to dozens of free models (the chain already uses Nemotron, Nex, Ling and more — at no cost).

### Option B — Z.ai public API (GLM)

1. Create an account at [z.ai](https://z.ai) (or [bigmodel.cn](https://bigmodel.cn)) and generate your API key
2. Add it to the environment variables:

   ```
   ZAI_API_KEY=your_key
   # optional:
   ZAI_BASE_URL=https://api.z.ai/api/paas/v4
   ZAI_MODEL=glm-4.5-flash
   ```

   The `glm-4.5-flash` model has a **free tier** with generous limits — ideal for the tutor.

> ℹ️ With no key at all, the tutor still tries the built-in Z-AI SDK, which **only works in development** (it relies on a sandbox-internal credential). In production (Vercel) it is silently ignored — that's why one of the keys above is required.

## ▲ Deploy to Vercel

The project is 100% Vercel-compatible — Next.js 16 App Router, no runtime database, no external services beyond OpenRouter:

1. **Import the repository** at [vercel.com/new](https://vercel.com/new) (detected framework: Next.js, build `next build`, nothing to adjust).
2. **Add the environment variable** in *Settings → Environment Variables* (Option A or B above):

   | Name | Value | Environments |
   | --- | --- | --- |
   | `OPENROUTER_API_KEY` | your key from [openrouter.ai/keys](https://openrouter.ai/keys) | Production, Preview, Development |
   | *or* `ZAI_API_KEY` | your key from [z.ai](https://z.ai) | Production, Preview, Development |

3. **Deploy.** Done — the tutor answers through the free model chain.

### Technical notes

- `next.config.ts` uses `output: "standalone"` — Vercel handles it natively.
- `prisma/` + SQLite exist as an optional scaffold; **nothing at runtime uses them** and no database configuration is required.
- Course PDFs and data are static in `public/` and `src/data/`.

## 🗂️ Main structure

```
src/
├── app/
│   ├── page.tsx            # Main app (client-side)
│   └── api/tutor/          # AI tutor + flashcards (OpenRouter + fallback)
├── components/hub/         # Dashboard, courses, PDF viewer, tutor, pomodoro…
├── data/course-data.ts     # Courses, professors, exams with official dates
├── lib/                    # semester.ts (calendar), tutor-context.ts, progress…
└── public/pdfs/            # Official course materials
```

---

Made with 💚 for the ADS class — IFPB Campus Cajazeiras.

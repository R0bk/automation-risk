## Automation Risk Explorer

This fork repurposes the base chat template into a public "automation share explorer" that lets anyone launch and replay AI workforce impact studies for named companies. The `/api/run` endpoint orchestrates GPT-5 with OpenAI web search, O*NET mappings, AnthropX automation/augmentation share overlays, and a new finaliser tool that emits a compact organisational report. Completed runs are cached, replayed on the landing page, and guarded by a global budget counter plus lightweight rate limiting.

### Getting started

1. **Install dependencies** – `pnpm install` (adds `@ai-sdk/openai`).
2. **Environment variables**
   - `OPENAI_API_KEY` – OpenAI Responses API key with web search access.
   - `POSTGRES_URL` – Neon (or Postgres) connection string.
   - `RUN_RATE_LIMIT` *(optional, default 3)* – new-company submissions per IP per window.
   - `RUN_RATE_LIMIT_WINDOW_MS` *(optional, default 3600000)*.
   - `RUN_CACHE_TTL_MS` *(optional, default 300000)* – in-memory replay cache TTL.
3. **Seed the database**
   - Apply migrations: `pnpm db:migrate`.
   - Insert a global budget row: `INSERT INTO "GlobalBudget" ("key", "remainingRuns") VALUES ('company_runs', 50);`
  - Load the O*NET role catalog: `pnpm exec tsx scripts/seed-onet-role-catalog.ts` (requires `POSTGRES_URL`).
4. **Local development** – `pnpm dev`, then open `http://localhost:3000`.

### Commands

| Command | Description |
| ------- | ----------- |
| `pnpm dev` | Start Next.js in development mode. |
| `pnpm build` | Runs database migrations then builds the app. |
| `pnpm start` | Starts the production server. |
| `pnpm test:unit` | Executes the new Node-based unit tests (currently slugify coverage). |

The original Chat SDK documentation follows for reference.

---

<a href="https://chat.vercel.ai/">
  <img alt="Next.js 14 and App Router-ready AI chatbot." src="app/(chat)/opengraph-image.png">
  <h1 align="center">Chat SDK</h1>
</a>

## Features

- [Next.js](https://nextjs.org) App Router
  - Advanced routing for seamless navigation and performance
  - React Server Components (RSCs) and Server Actions for server-side rendering and increased performance
- [AI SDK](https://ai-sdk.dev/docs/introduction)
  - Unified API for generating text, structured objects, and tool calls with LLMs
  - Hooks for building dynamic chat and generative user interfaces
  - Supports xAI (default), OpenAI, Fireworks, and other model providers
- [shadcn/ui](https://ui.shadcn.com)
  - Styling with [Tailwind CSS](https://tailwindcss.com)
  - Component primitives from [Radix UI](https://radix-ui.com) for accessibility and flexibility
- Data Persistence
  - [Neon Serverless Postgres](https://vercel.com/marketplace/neon) for saving chat history and user data
  - [Vercel Blob](https://vercel.com/storage/blob) for efficient file storage
- [Auth.js](https://authjs.dev)
  - Simple and secure authentication

## Model Providers

This template uses the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) to access multiple AI models through a unified interface. The default configuration includes [xAI](https://x.ai) models (`grok-2-vision-1212`, `grok-3-mini`) routed through the gateway.

### AI Gateway Authentication

**For Vercel deployments**: Authentication is handled automatically via OIDC tokens.

**For non-Vercel deployments**: You need to provide an AI Gateway API key by setting the `AI_GATEWAY_API_KEY` environment variable in your `.env.local` file.

With the [AI SDK](https://ai-sdk.dev/docs/introduction), you can also switch to direct LLM providers like [OpenAI](https://openai.com), [Anthropic](https://anthropic.com), [Cohere](https://cohere.com/), and [many more](https://ai-sdk.dev/providers/ai-sdk-providers) with just a few lines of code.

## Deploy Your Own

You can deploy your own version of the Next.js AI Chatbot to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/templates/next.js/nextjs-ai-chatbot)

## Running locally

You will need to use the environment variables [defined in `.env.example`](.env.example) to run Next.js AI Chatbot. It's recommended you use [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) for this, but a `.env` file is all that is necessary.

> Note: You should not commit your `.env` file or it will expose secrets that will allow others to control access to your various AI and authentication provider accounts.

1. Install Vercel CLI: `npm i -g vercel`
2. Link local instance with Vercel and GitHub accounts (creates `.vercel` directory): `vercel link`
3. Download your environment variables: `vercel env pull`

```bash
pnpm install
pnpm dev
```

Your app template should now be running on [localhost:3000](http://localhost:3000).

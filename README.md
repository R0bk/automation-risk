# Automation Risk Explorer

Automation Risk Explorer is a focused experience for running and replaying AI-driven automation-risk assessments for named companies. A single `/api/run` endpoint orchestrates advanced AI models with provider web search, O*NET mappings, and Anthropic automation/augmentation overlays to generate enriched organisational reports. Completed runs are cached, surfaced on the landing page, and gated by a global budgeting system so the experience remains fast and predictable for anonymous visitors.

## Key Capabilities
- Launch new company assessments with AI-assisted O*NET enrichment in one round-trip.
- Persist full transcripts and reports against an analyst-owned chat record for replay.
- Stream structured UI updates into the run experience, including tool results and reasoning traces.
- Enforce budget limits and rate limits per IP before allocating compute-intensive runs.

## Getting Started
1. **Install dependencies** – `pnpm install`
2. **Configure environment** – create an `.env.local` with the variables listed below.
3. **Apply database migrations** – `pnpm db:migrate`.
4. **Seed required data**
   - Insert an initial run budget: `INSERT INTO "GlobalBudget" ("key", "remainingRuns") VALUES ('company_runs', 50);`
   - Load the O*NET catalog: `pnpm exec tsx scripts/seed-onet-role-catalog.ts`
5. **Run locally** – `pnpm dev` and open [http://localhost:3000](http://localhost:3000).

## Configuration
| Variable | Purpose |
| --- | --- |
| `POSTGRES_URL` | Connection string for Neon/Postgres (used by Drizzle ORM). |
| `RUN_RATE_LIMIT` *(optional, default `3`)* | Maximum new company submissions per IP per window. |
| `RUN_RATE_LIMIT_WINDOW_MS` *(optional, default `3600000`)* | Rate-limit window in milliseconds. |
| `RUN_CACHE_TTL_MS` *(optional, default `300000`)* | TTL for in-memory cached run replays. |

## Commands
| Command | Description |
| --- | --- |
| `pnpm dev` | Start Next.js in development mode with fast refresh enabled. |
| `pnpm build` | Run database migrations and build the production bundle. |
| `pnpm start` | Serve the production build. |
| `pnpm test:unit` | Execute the current unit test suite (e.g. slugify utilities). |
| `pnpm db:migrate` | Run the Drizzle migration script (`lib/db/migrate.ts`). |

## Project Notes
- Next.js App Router powers both the run UI and the API surface.
- Transcripts are stored via the `Chat` + `Message_v2` tables; analysis runs reference these chat IDs for replay.
- Rate limiting and budget enforcement happen inside `app/api/run/route.ts` before any expensive tool calls execute.
- The UI lives under `components/run/*`, with `run-experience.tsx` coordinating the stream.

## Deployment
Deploy like any other Next.js app: ensure migrations have run in your target environment, set the environment variables above, and run `pnpm build && pnpm start`. The project is Vercel-ready, but any Node.js host that can supply the required environment variables and Postgres connectivity will work.

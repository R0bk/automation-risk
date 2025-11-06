# Automation Risk Explorer

Automation Risk Explorer is a focused experience for running and replaying AI-driven automation-risk assessments for named companies. A single `/api/run` endpoint orchestrates an agent with Exa web search, O*NET mappings, and Anthropic automation/augmentation overlays to generate enriched organisational reports. Completed runs are cached, surfaced on the landing page, and gated by a global budgeting system so the experience remains fast and predictable for anonymous visitors.

<!-- Screenshot placeholder - add project screenshot here -->
![Automation Risk Explorer](screenshot.png)

## Key Capabilities
- Launch new company assessments with AI-assisted O*NET enrichment in one round-trip.
- View aggregated automation impact across countries and industries with interactive heatmaps and distribution charts.
- Explore company hierarchies with ReactFlow-powered visualization showing role distributions and automation exposure.
- Discover popular company analyses on the landing page with trending runs.
- Persist full transcripts and reports against an analyst-owned chat record for replay.
- Stream structured UI updates into the run experience, including tool results and reasoning traces.
- Enforce budget limits and rate limits per IP before allocating compute-intensive runs.
- Bypass budget limits by providing your own OpenAI/Anthropic API key.

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
| `ANTHROPIC_API_KEY` *(optional)* | Use Anthropic Claude models instead of OpenAI (requires either this or OpenAI key). |
| `OPENROUTER_API_KEY` *(optional)* | Alternative provider supporting multiple models via OpenRouter. |
| `OPENROUTER_API` *(optional)* | OpenRouter endpoint URL if using OpenRouter. |
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
| ``curl -X POST http://localhost:3000/api/run/benchmark`` | Recompute and persist workforce impact scores for marketplace cards. |

## Run Maintenance
| Command | Description |
| --- | --- |
| `pnpm run runs:ls` | Dump every recorded run (newest first); add `--limit` or `--slug` flags as needed. |
| `pnpm tsx scripts/run-maintenance.ts list --slug acme-co` | Show the most recent runs for a given company slug (or omit `--slug` to see the global feed). |
| `pnpm tsx scripts/run-maintenance.ts delete --slug acme-co --keep-latest 1 --older-than-days 30` | Purge every run for `acme-co` except the newest one that is less than 30 days old. Add `--dry-run` first to preview. |
| `pnpm tsx scripts/run-maintenance.ts rename --slug acme-co --name "Acme Corporation"` | Rename the company display title (and refresh all associated chat titles); add `--new-slug` to move the route. |
| `pnpm tsx scripts/run-maintenance.ts rename --run-id <uuid> --name "Acme – April Run"` | Retitle a single run transcript; append `--update-company` if you also want the company display name to follow the new title. |

All maintenance commands use `POSTGRES_URL` from `.env.local`, so load that environment before invoking them.

## Project Notes
- Next.js App Router powers both the run UI and the API surface.
- Transcripts are stored via the `Chat` + `Message_v2` tables; analysis runs reference these chat IDs for replay.
- Rate limiting and budget enforcement happen inside `app/api/run/route.ts` before any expensive tool calls execute.
- The UI lives under `components/run/*`, with `run-experience.tsx` coordinating the stream.

## Methodology

Automation Risk Explorer employs a novel approach to workforce automation analysis by combining:

1. **O*NET Occupation Mapping**: Maps company job roles to standardized O*NET occupation codes (6-digit SOC codes covering ~1,000 occupations)
2. **AI-Powered Research**: Uses large language models with Exa web search to gather organizational structure and headcount data through iterative research
3. **Anthropic Task Analysis**: Integrates Anthropic's published automation/augmentation task usage data to compute per-role impact scores
4. **Hierarchical Organization Modeling**: Generates adaptive organizational hierarchies (2-5 levels) based on company size with headcount distribution estimates
5. **Streaming Analysis Pipeline**: Real-time SSE streaming with tool calls, reasoning traces, and incremental report building

The system produces structured reports containing:
- Complete organizational hierarchy with dominant roles per node
- Automation/augmentation shares per occupation (0.0-1.0 scale)
- Task mix breakdowns (automation tasks, augmentation tasks, manual tasks)
- Aggregated workforce impact metrics across departments and functions

## Comparative Analytics

Beyond individual company analysis, Automation Risk Explorer provides powerful comparative insights:

- **Country-Level Analysis**: Aggregates automation impact across 50+ countries with ISO code mapping for geographic visualization
- **Industry Aggregation**: Groups companies into normalized industry categories to identify sector-specific automation patterns
- **Cross-Dimensional Heatmaps**: Visualizes automation risk at the intersection of country × industry dimensions
- **Top Task Exposure**: Identifies the tasks with highest automation/augmentation exposure across all analyzed companies

This enables meaningful cross-company insights from the 1,000+ pre-analyzed global companies in the dataset.

## Dataset

This repository includes analysis scripts for generating workforce automation assessments for:
- **Top 250 S&P 500 companies** by market capitalization
- **Top 750 global companies** outside the S&P 500 (including major firms from China, Japan, Europe, India, South Korea, and other regions)

Total coverage: **1,000+ major global companies** across all industries.

## Citation

If you use this work, data, or methodology in your research, please cite:

```bibtex
@software{kopel2025automationrisk,
  author       = {Kopel, Rob},
  title        = {Automation Risk Explorer: AI-Driven Workforce Automation Analysis Platform},
  year         = {2025},
  publisher    = {GitHub},
  url          = {https://github.com/R0bk/automation-risk},
  note         = {Workforce automation analysis platform using O*NET occupation codes with AI-powered organizational mapping}
}
```

For dataset citations:
```bibtex
@dataset{kopel2025globalworkforce,
  author       = {Kopel, Rob},
  title        = {Global Workforce Automation Analysis Dataset: S\&P 500 + Major International Companies},
  year         = {2025},
  publisher    = {GitHub},
  url          = {https://github.com/R0bk/automation-risk},
  note         = {Automation and augmentation impact assessments for 350+ major global companies using O*NET occupation framework}
}
```

## Deployment
Deploy like any other Next.js app: ensure migrations have run in your target environment, set the environment variables above, and run `pnpm build && pnpm start`. The project is Vercel-ready, but any Node.js host that can supply the required environment variables and Postgres connectivity will work.

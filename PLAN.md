# Plan: Show AI Exposure Growth in Comparative Insights

## The Story
AI exposure is growing across the board. Show this in the existing comparative insights charts by threading delta data from the catalog into the analytics pipeline.

## Data Already Available
- Every `OnetCatalogRole` has `prior` (v1 snapshot) and `delta` (v4 minus v1)
- `buildComparativeAnalytics()` already loads catalog roles via `ONET_ROLE_LOOKUP` but ignores `.delta`
- Analysis scripts proved the math works at scale

## Changes

### 1. `lib/run/comparative-analytics-types.ts` — Add delta fields

Add to `CountryMetric` and `IndustryMetric`:
- `netExposureDelta: number | null` — net change in total AI exposure (auto + aug combined)
- `automationDelta: number | null` — avg change in automation tasks
- `augmentationDelta: number | null` — avg change in augmentation tasks

Add to `HeatmapCell`:
- `netExposureDelta: number | null`

Add to `TopTaskMetric`:
- `automationDelta: number | null`
- `augmentationDelta: number | null`

### 2. `lib/run/comparative-analytics.ts` — Accumulate deltas

In `GroupAccumulator`, add arrays for delta values. In the main loop (where catalog roles are already loaded ~line 329), push `catalogRole.delta` values into the accumulator. In the final mapping, compute weighted averages of deltas per country/industry/task.

### 3. `components/run/comparative-insights.tsx` — Show growth

**Industry bars**: Add a net exposure change indicator next to each row (e.g., "+2.3%" or an arrow showing growth). This tells the story "AI exposure in Education grew by X" not "automation declined in Education."

**Country bars**: Same treatment — net AI exposure growth per country.

**Heatmap cells**: Tooltips get delta context — "AI exposure grew by X% in this country × industry cell."

**Top tasks**: Show how headcount exposure shifted — "this task now affects X more people than before."

**Header**: Frame the whole section around growth — "AI exposure is increasing across industries and countries. Here's where it's growing fastest."

## What This Gets Right
- Shows real growth (total AI exposure UP almost everywhere)
- Doesn't claim automation is declining
- Doesn't mention methodology versions
- Gives users actionable "where is AI growing fastest" insight
- Uses data that already exists in the pipeline

## Scope
- 3 files: types, computation, component
- No new components, no new pages
- Extends existing charts with delta data they should have had all along

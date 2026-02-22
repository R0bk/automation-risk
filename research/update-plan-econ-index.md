# Comparison: Current Data vs. Anthropic Economic Index Updates

> Compiled: 2026-02-22

---

## What You Currently Have (Report 1/2 era data)

Your `onetData.json` (29 MB) contains the **original release** of the Anthropic Economic Index dataset. Here's exactly what's in it:

### Data Structure
```
onet_hierarchy → 23 sectors → 974 roles → 19,530 tasks
```

### Variables Per Task (7 metrics + 2 metadata)
| Variable | Description | Source |
|----------|-------------|--------|
| `pct` | Share of Claude conversations for this task | Report 1 |
| `count` | Conversation count | Report 1 |
| `automation_pct` | % of conversations that are automation | Report 1 |
| `augmentation_pct` | % of conversations that are augmentation | Report 1 |
| `directive_pct` | % directive (sub-type of automation) | Report 1 |
| `feedback_loop_pct` | % feedback loop (sub-type of automation) | Report 1 |
| `validation_pct` | % validation (sub-type of augmentation) | Report 1 |
| `task_iteration_pct` | % task iteration (sub-type of augmentation) | Report 1 |
| `learning_pct` | % learning (sub-type of augmentation) | Report 1 |

### Geographic Granularity
- **GLOBAL only** — single `"GLOBAL"` key per metric, no per-country breakdown

### Coverage
- 584 out of 974 roles have any automation/augmentation signal
- Data from **January 2025** Claude.ai Free & Pro conversations only
- No API data

### How It Flows Through Your App
1. `onetData.json` → parsed by `lib/onet/catalog.ts` → builds `OnetCatalogRole[]` with aggregated metrics per role
2. AI agent maps company roles to O\*NET codes → `dominantRoles` in org hierarchy
3. `enrich-report.ts` → looks up each O\*NET code → pulls `automationShare` and `augmentationShare` from catalog
4. `workforce-impact.ts` → headcount-weighted scores using task mix counts
5. `comparative-analytics.ts` → aggregates across runs by country/industry

---

## What's Available Now (Reports 2–4)

The HuggingFace dataset has **4 releases**. Here's what each adds:

### Release 2025-03-27 (Report 2)
- **Updated metrics** using Claude 3.7 Sonnet classifier (better accuracy)
- **630 bottom-up usage clusters** — granular usage patterns not captured by O\*NET (e.g., "battery technology guidance", "water management systems")
- **Removed occupational relevance filtering** — more data preserved
- Coding usage share increased; educational/learning interactions grew from 23% → 28%

### Release 2025-09-15 (Report 3)
- **Per-country metrics** for 150+ countries (not just GLOBAL)
- **First-party API data** (~1M API transcripts from August 2025, ~50% of 1P API traffic)
- **Country-level collaboration patterns** — automation vs augmentation varies by country development level
- **Enterprise API vs consumer** split (API is 97% automation-dominant vs ~50% on Claude.ai)
- **US state-level data** — per-state usage indices

### Release 2026-01-15 (Report 4) — Latest
- **Five Economic Primitives per task:**
  - Task complexity (estimated human hours)
  - Skill level (years of education for prompt & response)
  - Use case (work / education / personal)
  - AI autonomy (1–5 scale)
  - Task success rate
- **Effective coverage** — success-rate-weighted task coverage (vs. raw task coverage)
- **Productivity estimates** — reliability-adjusted labor productivity growth projections
- **US state convergence data** — Gini coefficient, diffusion modeling
- **Updated automation/augmentation** — augmentation rebounded to 52% (Nov 2025)
- Data from **November 2025** conversations, pre-Opus 4.5

---

## Gap Analysis: What Your App Is Missing

### HIGH IMPACT — Direct improvements to core scoring

| Gap | What It Means | Impact |
|-----|---------------|--------|
| **Stale classifier data** | You're using Jan 2025 metrics; Nov 2025 data has updated percentages from a better classifier (Sonnet 4.5) and 10 months of usage evolution | Scores may be inaccurate for roles where patterns shifted |
| **No task success rates** | Your scores assume 100% reliability; Report 4 shows success drops from ~70% (simple) to ~45% (complex 5hr+ tasks via API) | Current scores overestimate impact; reliability-weighting would halve some estimates |
| **No effective coverage** | You use raw task count ratios; Report 4 distinguishes "effective coverage" (weighted by actual task time + success) | Data entry workers = underestimated, microbiologists = overestimated |
| **No task complexity** | All tasks treated equally; Report 4 shows more complex tasks give bigger speedups but lower reliability | Missing nuance in impact scoring |

### MEDIUM IMPACT — Enriched context and comparative analytics

| Gap | What It Means | Impact |
|-----|---------------|--------|
| **No per-country metrics** | Your comparative analytics derive country scores from company run aggregation only | Could overlay real AEI per-country adoption rates onto company HQ analysis |
| **No API vs consumer split** | Enterprises use Claude very differently (97% automation); your data only reflects consumer patterns | Companies with heavy API use (tech firms) may have different risk profiles |
| **No skill/education data** | No deskilling/upskilling signal per role | Missing workforce transition narrative (e.g., "travel agents lose complex work, keep routine work") |
| **630 bottom-up clusters** | Your O\*NET mapping misses novel AI use cases not in traditional job descriptions | Some emerging tasks (prompt engineering, AI model evaluation) aren't captured |

### LOWER IMPACT — Nice-to-have enhancements

| Gap | What It Means | Impact |
|-----|---------------|--------|
| **No productivity projections** | Report 4 has macro productivity growth estimates (1.0–1.8 pp/year) | Could contextualize company scores against macro backdrop |
| **No US state data** | State-level convergence/diffusion data | Only relevant if you add state-level views |
| **No autonomy scale** | 1–5 delegation scale per task | Could refine automation vs augmentation classification |

---

## Recommended Update Plan

### Phase 1: Refresh Core Data (Highest ROI)

**Goal**: Replace `onetData.json` with the 2026-01-15 release data

1. **Download latest HuggingFace release** (`release_2026_01_15/`)
2. **Transform into your existing hierarchy format** — the structure should be compatible since it's the same O\*NET backbone
3. **Add new variable keys** to the hierarchy:
   ```
   Existing:      pct, count, automation_pct, augmentation_pct, directive_pct,
                   feedback_loop_pct, validation_pct, task_iteration_pct, learning_pct

   New to add:    success_rate, complexity_hours, education_years,
                   autonomy_level, use_case_work_pct, use_case_education_pct,
                   use_case_personal_pct
   ```
4. **Update `METRIC_KEYS`** in `lib/onet/catalog.ts` and `lib/ai/tools/onet-tools.ts`
5. **Validate**: run existing scoring on a few known companies and compare old vs new

**Files to modify:**
- `data/onet/onetData.json` — replace with new data
- `lib/onet/catalog.ts` — add new metric keys to `METRIC_KEYS`, extend `CatalogMetrics` type
- `lib/ai/tools/onet-tools.ts` — add new metric keys to `METRIC_KEYS` and `METRIC_LABELS`

### Phase 2: Add Reliability-Weighted Scoring

**Goal**: Use task success rates to compute "effective" automation/augmentation shares

1. **Extend `CatalogTaskMetric`** with `successRate: number` field
2. **In `aggregateRoleMetrics()`** (catalog.ts), compute effective shares:
   ```
   effectiveAutomationShare = automationShare × successRate
   effectiveAugmentationShare = augmentationShare × successRate
   ```
3. **Add `effectiveAutomationShare` / `effectiveAugmentationShare`** to `EnrichedOrgRole` schema
4. **Update `workforce-impact.ts`** to optionally use effective shares
5. **UI**: Show both raw and effective scores (e.g., "3.2 impact (2.1 reliability-adjusted)")

**Files to modify:**
- `lib/onet/catalog.ts` — add `successRate` to task metrics, compute effective shares
- `lib/run/report-schema.ts` — add `effectiveAutomationShare`, `effectiveAugmentationShare` to `enrichedOrgRoleSchema`
- `lib/run/enrich-report.ts` — populate effective shares from catalog
- `lib/run/workforce-impact.ts` — optionally weight by success rate
- UI components showing scores

### Phase 3: Add Per-Country Overlay

**Goal**: Integrate real AEI country-level adoption data into comparative analytics

1. **Ingest country-level CSV** from HuggingFace release (150+ countries with per-task metrics)
2. **Create `data/aei/country-metrics.json`** — preprocessed lookup by ISO code
3. **Extend `comparative-analytics.ts`** — overlay AEI country adoption index onto company HQ analysis
4. **Add country collaboration patterns** — show whether a country leans automation or augmentation

**Files to modify:**
- New: `data/aei/country-metrics.json`
- `lib/run/comparative-analytics.ts` — add AEI overlay
- `lib/run/comparative-analytics-types.ts` — extend `CountryMetric` type
- Country-level UI components

### Phase 4: Add Skill Composition & Deskilling Analysis

**Goal**: Show what happens to roles when AI-covered tasks are removed

1. **Add education years per task** from Report 4 primitives
2. **Compute per-role**: average education of AI-covered tasks vs remaining tasks
3. **Classify** as "deskilling" (AI handles high-skill tasks) or "upskilling" (AI handles low-skill tasks)
4. **Add to enriched role data** and surface in UI

**Files to modify:**
- `lib/onet/catalog.ts` — add `educationYears` to task metrics
- `lib/run/report-schema.ts` — add `skillShiftDirection` to role schema
- `lib/run/enrich-report.ts` — compute skill shift
- New UI component for skill shift visualization

---

## Data Compatibility Notes

- The O\*NET backbone (23 sectors → ~974 roles → ~19,500 tasks) should be **structurally identical** across all 4 releases — the hierarchy doesn't change, only the metrics attached to each node
- Your existing `onetRoleCodes.json` mapping should still work since O\*NET codes haven't changed
- The `variable` structure (`{ "metric_name": { "global": { "GLOBAL": value } } }`) should be the same, but Report 3+ data may include **additional region keys** beyond `"GLOBAL"` (e.g., country ISO codes)
- Your code currently reads `metric.global["GLOBAL"]` which will continue to work — new regions would be additive

## What to Download

From [huggingface.co/datasets/Anthropic/EconomicIndex](https://huggingface.co/datasets/Anthropic/EconomicIndex):

1. `release_2026_01_15/` — Latest data with all economic primitives
2. Check for a processed hierarchy file similar to your current format, or transform from the intermediate CSVs
3. The raw CSVs (`aei_raw_1p_api_2025-11-13_to_2025-11-20.csv` etc.) will need transformation into your hierarchy JSON format

---

## Quick Wins (Can Do Immediately)

1. **Just swap `onetData.json`** with the latest release — if the format is compatible, this alone updates all scores to Nov 2025 data with zero code changes
2. **Add `success_rate` display** to the onet_role_metrics tool output — even without changing scoring, showing success rates gives users context
3. **Add a "Data vintage" indicator** to reports — show that metrics are from "Nov 2025" rather than "Jan 2025"

# Plan: Update Automation Risk Explorer with Latest Anthropic Economic Index Data

> Compiled: 2026-02-22

---

## Current State

Your `onetData.json` (29 MB) contains **Report 1 era data** (Jan 2025):

```
onet_hierarchy → 23 sectors → 974 roles → 19,530 tasks
```

**7 metrics per task** (GLOBAL region only):
`pct`, `count`, `automation_pct`, `augmentation_pct`, `directive_pct`, `feedback_loop_pct`, `validation_pct`, `task_iteration_pct`, `learning_pct`

- 584/974 roles have automation/augmentation signal
- Claude.ai Free & Pro only, no API data, no geographic breakdown

**Data flow**: `onetData.json` → `catalog.ts` → `enrich-report.ts` → `workforce-impact.ts` → `comparative-analytics.ts`

---

## Latest Available: Release 2026-01-15 (Report 4)

**Important format change**: The v4 data is **flat CSVs**, not a nested JSON hierarchy like your current file.

### Files (142 MB total)
```
release_2026_01_15/
├── data/intermediate/
│   ├── aei_raw_claude_ai_2025-11-13_to_2025-11-20.csv   (94 MB)
│   └── aei_raw_1p_api_2025-11-13_to_2025-11-20.csv      (42 MB)
├── aei_v4_appendix.pdf                                   (6 MB)
└── data_documentation.md                                 (19 KB)
```

### CSV Schema (11 columns)
| Column | Type | Example |
|--------|------|---------|
| `geo_id` | string | `"USA"`, `"GBR"`, `"US-CA"`, `"GLOBAL"` |
| `geography` | string | `"country"`, `"country-state"`, `"global"` |
| `date_start` | date | `2025-11-13` |
| `date_end` | date | `2025-11-20` |
| `platform_and_product` | string | `"Claude AI (Free and Pro)"` |
| `facet` | string | `"onet_task"`, `"collaboration"`, `"request"` |
| `level` | int | 0, 1, 2 |
| `variable` | string | `"onet_task_pct"`, `"task_success_mean"` |
| `cluster_name` | string | `"Software Developers"`, `"onet_task::collaboration"` |
| `value` | float | numeric value |

### New Facets/Dimensions Available
| Facet | Description | Your Use |
|-------|-------------|----------|
| `onet_task` | Updated task-level automation/augmentation | **Replace current metrics** |
| `collaboration` | 6 collaboration types (directive, feedback_loop, learning, task_iteration, validation, none) | Already have these |
| `task_success` | Per-task success rates | **New: reliability weighting** |
| `human_only_time` | Hours for human alone (mean, median, CI) | **New: task complexity** |
| `human_with_ai_time` | Hours with AI (mean, median, CI) | **New: speedup ratio** |
| `ai_autonomy` | Delegation scale (0–1) | **New: refine auto/aug split** |
| `human_education_years` | Education needed for prompt | **New: skill composition** |
| `ai_education_years` | Education of response | **New: skill composition** |
| `use_case` | work / coursework / personal | **New: filter to work-only** |
| Intersections (`onet_task::collaboration`, `onet_task::task_success`, etc.) | Cross-dimensional breakdowns | **New: per-task success** |

### Geographic Coverage
- 150+ countries (3-letter ISO), 200+ conversation minimum
- US subnational regions (ISO 3166-2, e.g. `US-CA`)
- Separate Claude.ai and 1P API files

---

## Gap Analysis

### HIGH IMPACT — Core scoring improvements

| Gap | Current | With v4 | Effect on Scores |
|-----|---------|---------|-----------------|
| **Stale data** | Jan 2025 classifier | Nov 2025 + Sonnet 4.5 classifier | Updated % for all 974 roles |
| **No success rates** | Assumes 100% task reliability | 45–70% actual success by complexity | Halves some impact estimates |
| **No effective coverage** | Raw task-count ratios | Time-weighted + success-weighted coverage | Data entry ↑, microbiologists ↓ |
| **No task complexity** | All tasks equal weight | Hours to complete + speedup ratios | Complex tasks = bigger but riskier impact |

### MEDIUM IMPACT — Enriched analysis

| Gap | What v4 Adds |
|-----|-------------|
| **No per-country data** | Real AEI adoption rates for 150+ countries (vs. deriving from company runs) |
| **No API vs consumer** | Enterprise API is 97% automation-dominant — different risk profile for tech companies |
| **No education/skill data** | Deskilling/upskilling signal per role |
| **No use-case filtering** | Can filter to work-only (exclude coursework/personal) |

---

## Phase 1: ETL — Transform v4 CSVs into Your Hierarchy Format

**Goal**: Build a new `onetData.json` from the flat CSVs

The v4 CSV uses `facet` + `variable` + `cluster_name` to encode what your JSON encodes as nested hierarchy. You need a transformation script.

### Step 1.1: Download the data
```bash
# From HuggingFace
# release_2026_01_15/data/intermediate/aei_raw_claude_ai_2025-11-13_to_2025-11-20.csv
# release_2026_01_15/data/intermediate/aei_raw_1p_api_2025-11-13_to_2025-11-20.csv
```

### Step 1.2: Write ETL script (`scripts/transform-aei-v4.ts`)

The script needs to:

1. **Parse CSVs** — filter to `geo_id = "GLOBAL"` for core data
2. **Reconstruct hierarchy** — map `cluster_name` back to O\*NET sectors → roles → tasks using `SOC_Structure.csv` and `onet_task_statements.csv`
3. **Pivot facet rows into the nested `variable` structure** your code expects:
   ```
   CSV row:  facet=onet_task, variable=onet_task_pct, cluster_name="Software Developers", value=5.2

   JSON:     { "cluster_name": "Software Developers", "variable": { "pct": { "global": { "GLOBAL": 5.2 }}}}
   ```
4. **Add new metrics** from intersection facets:
   ```
   facet=onet_task::task_success → extract success_rate per task
   facet=onet_task + variable=human_only_time_mean → extract complexity_hours per task
   facet=onet_task + variable=human_education_years_mean → extract education_years per task
   ```
5. **Output** new `onetData.json` in the same nested format, plus a separate `onetCountryData.json` for per-country metrics

### Step 1.3: Validate output
- Compare role count (should still be ~974)
- Compare task count (should still be ~19,500)
- Spot-check a few known roles (e.g., Software Developers, Accountants) — metrics should be close but updated

**New files:**
- `scripts/transform-aei-v4.ts` — ETL script
- `data/onet/onetData.json` — replaced with v4 data
- `data/aei/country-metrics.json` — new, per-country lookup

**Effort**: Medium (ETL script is the main work; rest is format mapping)

---

## Phase 2: Extend Metric Keys in Code

**Goal**: Make the app aware of new metric dimensions

### Step 2.1: Update `lib/onet/catalog.ts`

```typescript
// Current METRIC_KEYS (7):
const METRIC_KEYS = [
  "automation_pct", "augmentation_pct", "directive_pct",
  "feedback_loop_pct", "validation_pct", "task_iteration_pct", "learning_pct",
] as const;

// Add new keys:
const METRIC_KEYS = [
  // existing
  "automation_pct", "augmentation_pct", "directive_pct",
  "feedback_loop_pct", "validation_pct", "task_iteration_pct", "learning_pct",
  // new from v4
  "success_rate",           // task success probability (0-1)
  "human_only_hours",       // estimated hours without AI
  "human_with_ai_hours",    // estimated hours with AI
  "education_years",        // years of education required
  "autonomy_level",         // AI delegation level (0-1)
  "use_case_work_pct",      // % that is work use
] as const;
```

### Step 2.2: Extend `CatalogMetrics` type
```typescript
type CatalogMetrics = {
  // existing fields...
  automationCount: number;
  augmentationCount: number;
  // ...

  // new fields:
  avgSuccessRate: number | null;          // role-level avg success rate
  avgComplexityHours: number | null;      // role-level avg human-only hours
  avgSpeedup: number | null;             // human_only / human_with_ai ratio
  avgEducationYears: number | null;       // role-level avg education
  effectiveAutomationShare: number | null; // automationShare × successRate
  effectiveAugmentationShare: number | null;
};
```

### Step 2.3: Update `lib/ai/tools/onet-tools.ts`
- Add new keys to `METRIC_LABELS`
- Include `success_rate` and `education_years` in tool output so the AI agent can reference them

**Files to modify:**
- `lib/onet/catalog.ts` — `METRIC_KEYS`, `CatalogMetrics`, `CatalogTaskMetric`, `aggregateRoleMetrics()`
- `lib/ai/tools/onet-tools.ts` — `METRIC_KEYS`, `METRIC_LABELS`, tool output shape

**Effort**: Low (type changes + plumbing)

---

## Phase 3: Reliability-Weighted Scoring

**Goal**: Use task success rates to produce "effective" impact scores alongside raw ones

### Step 3.1: Compute effective shares in `catalog.ts`

In `aggregateRoleMetrics()`, after computing `autoShare` and `augShare` per task:
```typescript
const successRate = toShare(getGlobalMetric(task, "success_rate"));

// Effective = raw × success probability
const effectiveAutoShare = autoShare * (successRate || 1);
const effectiveAugShare = augShare * (successRate || 1);
```

### Step 3.2: Add to report schema (`report-schema.ts`)

Extend `enrichedOrgRoleSchema`:
```typescript
effectiveAutomationShare: z.number().min(0).max(1).nullable().optional(),
effectiveAugmentationShare: z.number().min(0).max(1).nullable().optional(),
successRate: z.number().min(0).max(1).nullable().optional(),
complexityHours: z.number().nullable().optional(),
educationYears: z.number().nullable().optional(),
```

### Step 3.3: Populate in `enrich-report.ts`

In `buildRoleFromSources()`, pull effective shares from catalog:
```typescript
const effectiveAutomationShare = catalogMetrics?.effectiveAutomationShare ?? null;
const effectiveAugmentationShare = catalogMetrics?.effectiveAugmentationShare ?? null;
```

### Step 3.4: Update workforce impact (`workforce-impact.ts`)

Add a `computeEffectiveWorkforceImpact()` that mirrors `computeWorkforceImpact()` but uses effective shares. The existing function stays unchanged for backward compatibility.

### Step 3.5: Surface in UI

Show dual scores:
- "Impact Score: 6.4" (raw, current formula)
- "Reliability-Adjusted: 4.1" (with success weighting)

**Files to modify:**
- `lib/onet/catalog.ts` — effective share computation
- `lib/run/report-schema.ts` — new fields
- `lib/run/enrich-report.ts` — populate new fields
- `lib/run/workforce-impact.ts` — add effective scoring function
- `components/run/` — UI changes for dual scores

**Effort**: Medium

---

## Phase 4: Per-Country Data Overlay

**Goal**: Integrate real AEI country adoption data into comparative analytics

### Step 4.1: Create country lookup

From the v4 Claude.ai CSV, filter by `geography = "country"` and extract:
- Per-country `onet_task_pct` (which tasks each country uses most)
- Per-country `collaboration_pct` (automation vs augmentation lean)
- Per-country `usage_count` (volume)

Output as `data/aei/country-metrics.json`:
```json
{
  "USA": {
    "usageIndex": 1.0,
    "automationLean": 0.48,
    "augmentationLean": 0.52,
    "topTasks": ["Software Developers", "..."],
    "totalUsage": 12345
  },
  "IND": { ... }
}
```

### Step 4.2: Extend `comparative-analytics-types.ts`

Add to `CountryMetric`:
```typescript
aeiUsageIndex?: number;            // AEI per-capita usage vs baseline
aeiAutomationLean?: number;        // country-level auto/aug preference
aeiTopTasks?: string[];            // top O*NET tasks in this country
```

### Step 4.3: Merge in `comparative-analytics.ts`

When building country metrics, overlay AEI data:
```typescript
const aeiCountry = aeiCountryLookup[isoCode];
if (aeiCountry) {
  metric.aeiUsageIndex = aeiCountry.usageIndex;
  metric.aeiAutomationLean = aeiCountry.automationLean;
}
```

**Files to modify:**
- New: `data/aei/country-metrics.json` (generated by ETL)
- `lib/run/comparative-analytics-types.ts`
- `lib/run/comparative-analytics.ts`
- `components/run/comparative-insights.tsx` — display AEI overlay

**Effort**: Medium

---

## Phase 5: Skill Composition & Deskilling Analysis

**Goal**: Show workforce transition dynamics per role

### Step 5.1: Add education years to task metrics

In `CatalogTaskMetric`, add:
```typescript
educationYears: number | null;   // from human_education_years_mean
```

### Step 5.2: Compute skill shift per role

```typescript
// Average education of AI-covered tasks (automation + augmentation > 0)
const aiTaskEducation = mean(tasks.filter(t => t.automationShare + t.augmentationShare > 0).map(t => t.educationYears));

// Average education of remaining tasks
const manualTaskEducation = mean(tasks.filter(t => t.automationShare + t.augmentationShare === 0).map(t => t.educationYears));

// If AI handles higher-skill tasks → deskilling
// If AI handles lower-skill tasks → upskilling
const skillShift = aiTaskEducation - manualTaskEducation;
// > 0 = deskilling, < 0 = upskilling
```

### Step 5.3: Add to report schema

```typescript
skillShift: z.number().nullable().optional(),         // positive = deskilling
skillShiftLabel: z.enum(["deskilling", "upskilling", "neutral"]).optional(),
```

**Files to modify:**
- `lib/onet/catalog.ts` — education aggregation
- `lib/run/report-schema.ts` — skill shift fields
- `lib/run/enrich-report.ts` — compute skill shift
- New: UI component for skill shift visualization

**Effort**: Medium

---

## Priority Order & Dependencies

```
Phase 1 (ETL) ──────→ Phase 2 (Metric Keys) ──────→ Phase 3 (Reliability Scoring)
     │                                                         │
     └──→ Phase 4 (Country Data) ──────────────────────────────┘
                                                               │
                                                    Phase 5 (Skill Analysis)
```

**Phase 1 is the prerequisite for everything else.** Without transforming the v4 CSVs into your hierarchy format, no downstream changes work.

| Phase | Effort | Impact | Prerequisite |
|-------|--------|--------|-------------|
| 1. ETL | Medium | Foundation for all else | None |
| 2. Metric Keys | Low | Unlocks new data in tools | Phase 1 |
| 3. Reliability Scoring | Medium | Most impactful single change | Phase 1, 2 |
| 4. Country Overlay | Medium | Enriches comparative analytics | Phase 1 |
| 5. Skill Analysis | Medium | New narrative layer | Phase 1, 2 |

---

## Quick Wins (Independent of Phases)

These require no data changes:

1. **Add "Data vintage" label** — show "Based on Jan 2025 Claude usage data" on reports so users know the freshness
2. **Display existing sub-metrics** — you already have `directive_pct`, `feedback_loop_pct`, etc. but they're only used for classification, not shown to users. Surfacing them adds free insight.
3. **Link to Anthropic Economic Index** — add a citation/link to the AEI on reports since your data comes from it

---

## Data Compatibility Warning

Your current `onetData.json` is a **pre-built nested JSON hierarchy**. The v4 HuggingFace release is **flat CSVs**. There is no direct drop-in replacement — you need the ETL script (Phase 1) to bridge the format gap.

However, the underlying O\*NET taxonomy (sectors → roles → tasks) is the same across all releases. The `onetRoleCodes.json` mapping should continue to work unchanged. The CSV `cluster_name` values should map to the same `cluster_name` values in your hierarchy.

The key question for Phase 1 is: **where did the original `onetData.json` come from?** If Anthropic published a hierarchy JSON alongside Report 1 (not visible on current HuggingFace), the v4 release may also have an equivalent file not yet discovered. Otherwise, the ETL script is needed.

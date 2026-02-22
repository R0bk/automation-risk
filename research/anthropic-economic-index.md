# Anthropic Economic Index — Research Summary

> Compiled: 2026-02-22
> Source: Anthropic Research (4 reports, Feb 2025 – Jan 2026)
> Dataset: [Anthropic/EconomicIndex on Hugging Face](https://huggingface.co/datasets/Anthropic/EconomicIndex)
> Landing page: [anthropic.com/economic-index](https://www.anthropic.com/economic-index)
> Academic paper: [arxiv.org/abs/2503.04761](https://arxiv.org/abs/2503.04761)

---

## 1. What Is It?

The Anthropic Economic Index is an ongoing, data-driven research initiative that tracks how Claude is actually being used in the economy. Rather than relying on surveys or expert forecasts about which jobs AI *could* automate, it analyzes real usage data to show which tasks AI *is* being used for today.

The index maps anonymized Claude conversations to the U.S. Department of Labor's O\*NET occupational taxonomy (~20,000 work tasks across ~1,000 occupations), using a privacy-preserving tool called **Clio** that aggregates conversations into categories without exposing individual content to researchers.

**Core insight from economics literature:** It makes more sense to analyze occupational *tasks* rather than whole occupations, because jobs share tasks, and certain tasks are more amenable to AI automation/augmentation than others.

---

## 2. Timeline of Reports

| # | Date | Title | Key Contribution |
|---|------|-------|-----------------|
| 1 | Feb 2025 | [Introducing the Anthropic Economic Index](https://www.anthropic.com/news/the-anthropic-economic-index) | Foundational methodology; automation vs. augmentation framework; O\*NET task mapping |
| 2 | Mar 2025 | [Insights from Claude 3.7 Sonnet](https://www.anthropic.com/news/anthropic-economic-index-insights-from-claude-sonnet-3-7) | Bottom-up taxonomy (630 usage clusters); extended thinking adoption; learning interaction growth |
| 3 | Sep 2025 | [Uneven geographic and enterprise patterns](https://www.anthropic.com/research/anthropic-economic-index-september-2025-report) | Geographic analysis (150+ countries); enterprise API patterns; first time automation > augmentation |
| 4 | Jan 2026 | [Economic Primitives](https://www.anthropic.com/research/anthropic-economic-index-january-2026-report) | Five new measurement dimensions; productivity estimates; US state convergence; skill composition |

---

## 3. Methodology

### Data Sources
- **Claude.ai conversations**: ~1M randomly sampled from Free, Pro, and Max plans per report period
- **API transcripts**: ~1M records (~50% of first-party API traffic) added from Report 3 onward
- **Exclusions**: Team, Enterprise, and third-party API usage not included

### Classification Pipeline
1. Conversations are processed by **Clio**, which maps them to O\*NET tasks without exposing raw content
2. Classification uses Claude itself, validated against human annotations (Claude.ai) and synthetic/internal data (API)
3. Privacy thresholds: minimum 15 conversations and 5 unique users per reported data cell
4. Report 2 switched to Claude 3.7 Sonnet for classification; Report 4 used chain-of-thought prompting selectively (only 3 classifiers where it improved accuracy)

### Collaboration Framework
Every conversation is classified into one of two modes:

**Augmentation** (human-in-the-loop, ~57% initially):
- Task Iteration (31.3%) — collaborative refinement
- Learning (23.3%) — user seeks understanding
- Validation (2.8%) — checking/verifying work

**Automation** (AI completes task with minimal interaction, ~43% initially):
- Directive (27.8%) — full task delegation
- Feedback Loop (14.8%) — iterative delegation

### Economic Primitives (Report 4, Jan 2026)
Five new foundational measurement dimensions:

| Primitive | What It Measures |
|-----------|-----------------|
| **Task complexity** | Estimated hours for human completion alone, time with AI collaboration, task multiplicity |
| **Human & AI skills** | Years of education needed to understand user prompts and Claude responses |
| **Use case** | Work, educational, or personal application |
| **AI autonomy** | Degree of decision-making delegation (1–5 scale) |
| **Task success** | Claude's assessment of whether task was completed successfully |

---

## 4. Key Findings

### 4.1 Task Concentration

Usage is heavily concentrated in a small number of tasks:

- **Top 10 tasks** account for 24% of Claude.ai conversations and 32% of API traffic (Jan 2026)
- **"Modifying software to correct errors"** alone is ~6% of Claude.ai usage and ~10% of API records
- **Computer & mathematical tasks** = 34% of Claude.ai, 46% of API (vs. 3.4% of US workforce)
- Educational instruction usage grew from 9% → 15% (Jan 2025 → Nov 2025)

**Occupational distribution (Report 1):**

| Occupation Group | % of Claude Conversations | % of US Workforce |
|-----------------|--------------------------|-------------------|
| Computer & Mathematical | 37.2% | 3.4% |
| Arts, Design, Entertainment | 10.3% | 1.4% |
| Education & Library | 9.3% | — |
| Office & Administrative | 7.9% | — |
| Life Sciences | 6.4% | — |
| Business & Financial | 5.9% | — |
| Farming, Fishing, Forestry | 0.1% | — |

### 4.2 Automation vs. Augmentation Over Time

| Period | Augmentation (Claude.ai) | Automation (Claude.ai) | Automation (API) |
|--------|--------------------------|----------------------|-----------------|
| Jan 2025 (Report 1) | 57% | 43% | — |
| Mar 2025 (Report 2) | 57% | 43% | — |
| Aug 2025 (Report 3) | 45% | 55% | 97% |
| Nov 2025 (Report 4) | 52% | 45% | 97% |

- Report 3 was the first time automation exceeded augmentation on Claude.ai
- Report 4 saw augmentation rebound, correlated with product changes (file creation, persistent memory, Skills)
- API usage is overwhelmingly automation-dominant (97%) across all periods
- Directive interactions fell from 39% → 32% between Aug–Nov 2025

### 4.3 Job Coverage

- **36% of occupations** use AI for at least 25% of their associated tasks (Report 1)
- This rose to **49%** when pooling data across all four reports (Report 4)
- Only **~4% of occupations** use AI for 75%+ of tasks
- Mid-to-high wage occupations show heaviest usage; lowest- and highest-paid roles show minimal adoption

### 4.4 Skill & Wage Effects

- Claude usage concentrates on higher-education tasks: mean **14.4 years of education** vs. economy-wide average of **13.2 years**
- Education levels of prompts and responses correlate near-perfectly (r > 0.92) — sophisticated prompts get sophisticated responses
- **Net deskilling effect**: when AI-covered tasks are removed from jobs, remaining tasks generally require less education
  - Example: Travel agents lose complex planning tasks, leaving routine ticketing
  - Counter-example: Property managers lose routine bookkeeping, leaving higher-judgment work (upskilling)

### 4.5 Geographic Distribution

**Global (Report 3, Aug 2025):**
- US: 21.6% of total Claude usage
- India: 7.2%, Brazil: 3.7%
- Per-capita leaders: Israel (7.0x expected), Singapore (4.57x), Australia (4.10x)
- Strong GDP correlation: 1% GDP per capita increase → 0.7% usage per capita increase
- Lower-adoption countries focus on coding (>50% in India vs. 33% globally)
- Higher-adoption countries show diversified usage

**US State-Level (Report 4, Nov 2025):**
- DC leads (3.82x population-adjusted), Utah (3.78x), California (2.13x)
- California = 25.3% of total US usage
- Gini coefficient fell from 0.37 → 0.32 (Aug → Nov 2025), showing rapid convergence
- Each 1% increase in computer/mathematical professionals → 0.36% higher usage per capita
- Workforce composition explains ~⅔ of cross-state variation
- Convergence modeling suggests 2–5 years to equalize across states (~10x faster than historical technology diffusion)

**Collaboration patterns vary by development:**
- Low-adoption countries: automation-dominant (delegate complete tasks)
- High-adoption countries: augmentation-dominant (collaborative iteration)

### 4.6 Enterprise API vs. Consumer

| Dimension | Claude.ai | API |
|-----------|-----------|-----|
| Computer/math tasks | 36% | 44% |
| Automation rate | ~50% | 97% |
| Educational tasks | 12.3% | 3.6% |
| Price sensitivity | — | 1% cost increase → 0.29% usage decrease |

- Businesses prioritize model capabilities over cost
- Output complexity varies 4x across tasks (10th to 90th percentile)
- Input-output elasticity: 0.38 (each 1% input increase → 0.38% output increase)

### 4.7 Task Success & Reliability

- Success rates decline with complexity: ~70% for tasks requiring <12 years education, ~66% for college-level (16 years)
- API success rates: ~60% for sub-hour tasks → ~45% for 5+ hour tasks
- Linear extrapolation: 50% success at ~3.5 hours (API), ~19 hours (Claude.ai)
- Claude.ai's higher success on long tasks likely reflects multi-turn iterative refinement
- **Fundamental tradeoff**: more complex tasks yield greater time savings but lower reliability

### 4.8 Productivity Impact Estimates (Report 4)

| Scenario | Annual US Labor Productivity Growth |
|----------|-------------------------------------|
| Baseline (no reliability adjustment) | +1.8 percentage points |
| Reliability-adjusted (Claude.ai) | +1.2 percentage points |
| Reliability-adjusted (API) | +1.0 percentage points |
| Task complements (elasticity = 0.5) | +0.7–0.9 percentage points |
| Task substitutes (elasticity = 1.5) | +2.2–2.6 percentage points |

For context, US labor productivity growth has averaged ~1.5% annually since 2000, so even the conservative estimates represent a meaningful acceleration.

---

## 5. Effective AI Coverage vs. Task Coverage

Report 4 introduced the distinction between **task coverage** (what fraction of an occupation's tasks Claude is used for) and **effective coverage** (how much of a worker's actual time Claude can successfully handle).

Notable divergences:
- **Data entry workers**: High effective coverage despite limited task coverage (Claude excels at their most time-intensive duties)
- **Radiologists**: High effective coverage relative to task count
- **Microbiologists**: Lower effective coverage than task coverage suggests (hands-on lab work dominates time)
- **Teachers & software developers**: Relatively less affected than task coverage alone would suggest

---

## 6. Limitations

1. **Population bias**: Only Free, Pro, and Max Claude.ai users + first-party API; excludes Team/Enterprise plans
2. **Intent unknown**: Can't confirm if users were doing work tasks vs. personal projects
3. **Output usage unknown**: Unclear whether responses are copy-pasted verbatim or heavily edited
4. **Coding overrepresentation**: Claude is marketed partly as a coding tool, potentially inflating programming usage
5. **O\*NET taxonomy limitations**: May miss novel AI use cases not captured in traditional job descriptions
6. **Single-model view**: Only captures Claude usage, not the broader AI adoption landscape
7. **Short time series**: Convergence estimates rely on only 3 months of data (high uncertainty)
8. **VPN/proxy noise**: Geographic attribution relies on IP geolocation

---

## 7. Dataset Details

**Available on**: [Hugging Face — Anthropic/EconomicIndex](https://huggingface.co/datasets/Anthropic/EconomicIndex)
**License**: CC-BY (data), MIT (code)
**Contact**: econ-research@anthropic.com

### Data Releases

| Release Date | Key Content |
|-------------|-------------|
| 2025-02-10 | Initial O\*NET task mappings, automation vs. augmentation |
| 2025-03-27 | Updated with Claude 3.7 Sonnet data; 630 bottom-up usage clusters |
| 2025-09-15 | Geographic data (150+ countries); first-party API data |
| 2026-01-15 | Economic primitives; productivity estimates; convergence modeling |

### File Structure
- CSV files organized by release date under `release_YYYY_MM_DD/data/intermediate/`
- Example: `aei_raw_1p_api_2025-11-13_to_2025-11-20.csv`
- Supported formats: CSV, TSV, JSON, JSONL, Parquet

---

## 8. Relevance to This Project

The Anthropic Economic Index is directly relevant to the Automation Risk Explorer in several ways:

1. **O\*NET foundation**: Both this project and the Index use O\*NET task mappings as the core occupational taxonomy — the datasets are complementary
2. **Automation/augmentation classification**: The Index's framework for categorizing AI interactions maps directly to this project's task mix breakdown
3. **Effective coverage metrics**: The distinction between task coverage and effective coverage (Report 4) could enrich the per-role impact scores
4. **Geographic & industry context**: The Index's country-level and industry-level data can power the comparative analytics features
5. **Productivity estimates**: The reliability-adjusted productivity growth numbers provide macroeconomic grounding for company-level assessments
6. **Deskilling/upskilling dynamics**: The skill composition analysis could inform more nuanced workforce impact narratives

### Potential Data Integration Points

- **HuggingFace dataset** → ingest task-level automation/augmentation rates by O\*NET code for more empirically grounded risk scores
- **Economic primitives** → add task complexity and success rate dimensions to role-level analysis
- **Geographic data** → enhance country-level comparative analytics with real adoption patterns
- **Bottom-up taxonomy** (630 clusters) → supplement O\*NET mapping with emerging AI use cases not in traditional job descriptions
- **Productivity estimates** → incorporate reliability-adjusted growth projections into workforce impact scoring

---

## 9. Sources

- [Anthropic Economic Index — Landing Page](https://www.anthropic.com/economic-index)
- [Report 1: Introducing the Anthropic Economic Index (Feb 2025)](https://www.anthropic.com/news/the-anthropic-economic-index)
- [Report 2: Insights from Claude 3.7 Sonnet (Mar 2025)](https://www.anthropic.com/news/anthropic-economic-index-insights-from-claude-sonnet-3-7)
- [Report 3: Uneven Geographic and Enterprise Patterns (Sep 2025)](https://www.anthropic.com/research/anthropic-economic-index-september-2025-report)
- [Report 4: Economic Primitives (Jan 2026)](https://www.anthropic.com/research/anthropic-economic-index-january-2026-report)
- [Full Paper: "Which Economic Tasks are Performed with AI?" (arXiv)](https://arxiv.org/abs/2503.04761)
- [Dataset on Hugging Face](https://huggingface.co/datasets/Anthropic/EconomicIndex)
- [India Country Brief](https://www.anthropic.com/research/india-brief-economic-index)
- [Economic Primitives PDF](https://www-cdn.anthropic.com/096d94c1a91c6480806d8f24b2344c7e2a4bc666.pdf)

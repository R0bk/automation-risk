# Plan: Measurement-Correction Framing in Comparative Insights

v1→v4 is a measurement correction. Automation is increasing — v1 just over-counted it.

All changes in `components/run/comparative-insights.tsx`.

---

### 1. Header — add methodology anchor (after line 613)

Currently says "Where is AI exposure the highest?" with auto/aug legend and coverage stats. No mention of which methodology version or that classification has been corrected.

Add a short line after the description:
> "Measured using Anthropic's Economic Index v4 — the most accurate task classification to date. Earlier versions over-attributed tasks to automation; v4 corrects this."

### 2. Top tasks section — ground the framing (lines 868–882)

Currently says tasks represent "highest headcount exposure to AI automation and augmentation." Users might assume the auto/aug split is stable or that lower automation = less automation in reality.

Add a note below:
> "Automation capability continues to grow. Measured automation shares reflect classification accuracy, not the pace of real-world automation."

### 3. Industry/country bars — tooltip context

The `ScoreBar` component and row renderers show auto/aug stacked bars per industry and country. No tooltip explains what the split means or that it's methodology-dependent.

Update the "Avg share of roles (%)" label (line 638) or add a subtitle:
> "Based on v4 classification · automation share reflects measurement, not adoption level"

---

3 targeted copy changes, 1 file, no new components.

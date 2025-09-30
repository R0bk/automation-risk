function normalizeShareValue(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 0) {
    return 0;
  }

  if (value <= 1) {
    return value;
  }

  // Treat values expressed as percentages (e.g. 63.5) as percentage points.
  if (value <= 1000) {
    const scaled = value / 100;
    if (scaled <= 1) {
      return scaled;
    }
  }

  return 1;
}

export function normaliseLegacyReport(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normaliseLegacyReport(item));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};

    for (const [key, fieldValue] of Object.entries(record)) {
      let normalisedKey = key;
      if (key === "automationRisk") {
        normalisedKey = "automationShare";
      } else if (key === "augmentationScore") {
        normalisedKey = "augmentationShare";
      } else if (key === "anthropicAutomationRisk") {
        normalisedKey = "automationShare";
      } else if (key === "anthropicAugmentationScore") {
        normalisedKey = "augmentationShare";
      } else if (key === "no_signal_task_count") {
        normalisedKey = "manual_task_count";
      } else if (key === "dominantRoleIds") {
        normalisedKey = "dominantRoles";
      }

      if (normalisedKey === "dominantRoles") {
        const entries = Array.isArray(fieldValue) ? fieldValue : [];
        next[normalisedKey] = entries
          .map((entry) => {
            if (typeof entry === "string") {
              const id = entry.trim();
              return id ? { id, headcount: null } : null;
            }
            if (entry && typeof entry === "object") {
              const objectEntry = entry as Record<string, unknown>;
              const rawId = typeof objectEntry.id === "string" ? objectEntry.id : typeof objectEntry.code === "string" ? objectEntry.code : null;
              const id = rawId ? rawId.trim() : "";
              if (!id) {
                return null;
              }
              const rawHeadcount = objectEntry.headcount;
              const headcount =
                typeof rawHeadcount === "number" && Number.isFinite(rawHeadcount)
                  ? Math.max(0, Math.trunc(rawHeadcount))
                  : null;
              return { id, headcount };
            }
            return null;
          })
          .filter((entry): entry is { id: string; headcount: number | null } => Boolean(entry));
        continue;
      }

      next[normalisedKey] = normaliseLegacyReport(fieldValue);
    }

    if (
      typeof next.taskMixCounts === "undefined" &&
      (typeof next.automationTaskCount === "number" ||
        typeof next.augmentationTaskCount === "number" ||
        typeof next.manualTaskCount === "number")
    ) {
      const automationValue = typeof next.automationTaskCount === "number" ? Math.max(0, Math.trunc(next.automationTaskCount)) : null;
      const augmentationValue = typeof next.augmentationTaskCount === "number" ? Math.max(0, Math.trunc(next.augmentationTaskCount)) : null;
      const manualValue = typeof next.manualTaskCount === "number" ? Math.max(0, Math.trunc(next.manualTaskCount)) : null;

      if (automationValue != null || augmentationValue != null || manualValue != null) {
        const automation = automationValue ?? 0;
        const augmentation = augmentationValue ?? 0;
        const manual = manualValue ?? 0;
        const total =
          typeof next.totalTaskCount === "number"
            ? Math.max(0, Math.trunc(next.totalTaskCount))
            : automation + augmentation + manual;

        next.taskMixCounts = {
          automation,
          augmentation,
          manual,
          total,
        };
      }
    }

    if (
      typeof next.taskMixShares === "undefined" &&
      (typeof next.automationShare === "number" || typeof next.augmentationShare === "number")
    ) {
      const autoShare = typeof next.automationShare === "number" ? next.automationShare : null;
      const augShare = typeof next.augmentationShare === "number" ? next.augmentationShare : null;
      const manualShare = autoShare != null || augShare != null ? Math.max(0, 1 - (autoShare ?? 0) - (augShare ?? 0)) : null;

      next.taskMixShares = {
        automation: autoShare,
        augmentation: augShare,
        manual: manualShare,
      };
    }

    delete next.automationTaskCount;
    delete next.augmentationTaskCount;
    delete next.manualTaskCount;
    delete next.totalTaskCount;

    if (typeof next.automationShare === "number") {
      const normalized = normalizeShareValue(next.automationShare);
      if (normalized != null) {
        next.automationShare = normalized;
      }
    }

    if (typeof next.augmentationShare === "number") {
      const normalized = normalizeShareValue(next.augmentationShare);
      if (normalized != null) {
        next.augmentationShare = normalized;
      }
    }

    if (typeof next.manualShare === "number") {
      const normalized = normalizeShareValue(next.manualShare);
      if (normalized != null) {
        next.manualShare = normalized;
      }
    }

    if (next.taskMixShares && typeof next.taskMixShares === "object") {
      const shares = next.taskMixShares as Record<string, unknown>;
      for (const key of Object.keys(shares)) {
        if (typeof shares[key] === "number") {
          const normalized = normalizeShareValue(shares[key]);
          if (normalized != null) {
            shares[key] = normalized;
          }
        }
      }
    }

    return next;
  }

  return value;
}

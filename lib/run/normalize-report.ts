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

    return next;
  }

  return value;
}

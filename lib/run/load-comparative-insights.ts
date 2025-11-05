import "server-only";

import { getAnalyticsSnapshot } from "@/lib/db/queries";
import {
  comparativeAnalyticsSchema,
  type ComparativeAnalytics,
} from "./comparative-analytics-types";
import { LANDING_ANALYTICS_SNAPSHOT_KEY } from "@/lib/constants/analytics";

export async function loadComparativeInsights(): Promise<{
  data: ComparativeAnalytics | null;
  updatedAt: string | null;
}> {
  const snapshot = await getAnalyticsSnapshot(LANDING_ANALYTICS_SNAPSHOT_KEY);
  if (!snapshot) {
    return { data: null, updatedAt: null };
  }

  const parsed = comparativeAnalyticsSchema.safeParse(snapshot.payload);
  if (!parsed.success) {
    console.warn("[analytics] snapshot payload parse failed", parsed.error.flatten());
    return { data: null, updatedAt: snapshot.updatedAt?.toISOString?.() ?? null };
  }

  return {
    data: parsed.data,
    updatedAt: snapshot.updatedAt?.toISOString?.() ?? null,
  };
}

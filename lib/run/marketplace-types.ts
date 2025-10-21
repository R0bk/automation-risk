import type { WorkforceImpactSnapshot } from "./workforce-impact";

export interface MarketplaceRun {
  runId: string;
  slug: string | null;
  displayName: string | null;
  status: string | null;
  viewCount: number;
  updatedAt: string | Date;
  hqCountry: string | null;
  workforceMetric: WorkforceImpactSnapshot | null;
}

export interface MarketplacePage {
  runs: MarketplaceRun[];
  pagination: {
    limit: number;
    offset: number;
    nextOffset: number | null;
    hasMore: boolean;
  };
}

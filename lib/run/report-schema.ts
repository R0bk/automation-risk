import { z } from "zod";

export const orgRoleSchema = z.object({
  onetCode: z.string().min(1).max(32),
  title: z.string().min(1).max(256),
  normalizedTitle: z.string().min(1).max(256).optional(),
  parentCluster: z.string().min(1).max(256).optional(),
  headcount: z.number().int().nonnegative().nullable().optional(),
  automationShare: z.number().min(0).max(1).nullable().optional(),
  augmentationShare: z.number().min(0).max(1).nullable().optional(),
  taskMixCounts: z
    .object({
      automation: z.number().int().nonnegative(),
      augmentation: z.number().int().nonnegative(),
      manual: z.number().int().nonnegative(),
      total: z.number().int().nonnegative().optional(),
    })
    .optional(),
  taskMixShares: z
    .object({
      automation: z.number().min(0).max(1).nullable().optional(),
      augmentation: z.number().min(0).max(1).nullable().optional(),
      manual: z.number().min(0).max(1).nullable().optional(),
    })
    .optional(),
  topTasks: z
    .array(
      z.object({
        name: z.string().min(1).max(256),
        automation: z.number().min(0).max(1).nullable().optional(),
        augmentation: z.number().min(0).max(1).nullable().optional(),
        weight: z.number().min(0).max(1).nullable().optional(),
      })
    )
    .max(25)
    .optional(),
  notes: z.string().max(2000).optional(),
  sources: z.array(z.string().url()).max(20).optional(),
});

export const orgNodeSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  level: z.number().int().min(0).max(10),
  parentId: z.string().min(1).max(64).nullable(),
  headcount: z.number().int().nonnegative().nullable().optional(),
  automationShare: z.number().min(0).max(1).nullable().optional(),
  augmentationShare: z.number().min(0).max(1).nullable().optional(),
  dominantRoleIds: z.array(z.string()).max(12).optional().describe("O*NET code (e.g. 41-1011.00)"),
  summary: z.string().max(2000).optional(),
  collapsed: z.boolean().optional(),
  highlights: z
    .array(
      z.object({
        label: z.string().min(1).max(128),
        value: z.string().min(1).max(256),
      })
    )
    .max(10)
    .optional(),
});

export const aggregationBucketSchema = z.object({
  key: z.string().min(1).max(128),
  headcount: z.number().int().nonnegative().nullable().optional(),
  automationShare: z.number().min(0).max(1).nullable().optional(),
  augmentationShare: z.number().min(0).max(1).nullable().optional(),
  notes: z.string().max(1000).optional(),
});

export const aggregationSchema = z.object({
  type: z.enum([
    "function",
    "geography",
    "business_unit",
    "seniority",
    "other",
  ]),
  label: z.string().min(1).max(128),
  buckets: z.array(aggregationBucketSchema).max(100),
});

export const reportSourceSchema = z.object({
  title: z.string().max(256).optional(),
  url: z.string().url(),
  snippet: z.string().max(1000).optional(),
});

export const orgReportSchema = z.object({
  metadata: z.object({
    companyName: z.string().min(1).max(256),
    companySlug: z.string().min(1).max(128),
    summary: z.string().max(2000).optional(),
    lastUpdatedIso: z.string().min(4).max(64),
    hqCountry: z.string().max(128).optional(),
    workforceEstimate: z.number().int().nonnegative().nullable().optional(),
    sources: z.array(reportSourceSchema).max(100).default([]),
  }),
  hierarchy: z.array(orgNodeSchema).max(400),
  roles: z.array(orgRoleSchema).max(400),
  aggregations: z.array(aggregationSchema).max(120).optional().default([]),
  visualizationHints: z
    .object({
      rootId: z.string().min(1).max(64).optional(),
      collapsedNodeIds: z.array(z.string().min(1).max(64)).max(200).optional().describe("Leave empty"),
      highlightRoleIds: z.array(z.string().min(1).max(64)).max(200).optional().describe("O*NET code (e.g. 51-4072)"),
      layout: z.enum(["compact", "balanced", "layered"]).optional(),
    })
    .partial()
    .optional(),
});

export type OrgRole = z.infer<typeof orgRoleSchema>;
export type OrgNode = z.infer<typeof orgNodeSchema>;
export type Aggregation = z.infer<typeof aggregationSchema>;
export type OrgReport = z.infer<typeof orgReportSchema>;

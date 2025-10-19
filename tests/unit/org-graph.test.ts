import test from "node:test";
import assert from "node:assert/strict";

import { buildOrgGraph } from "@/lib/run/org-graph";
import { buildOrgFlowModel } from "@/lib/run/org-flow-model";
import { applyLayeredLayout } from "@/lib/run/org-flow-layout";
import type { EnrichedOrgReport } from "@/lib/run/report-schema";
import { getDenseNodePreferredHeight } from "@/lib/run/org-flow-tokens";

const sampleReport: EnrichedOrgReport = {
  metadata: {
    companyName: "Example Corp",
    companySlug: "example-corp",
    lastUpdatedIso: new Date().toISOString(),
    sources: [],
  },
  hierarchy: [
    {
      id: "root",
      name: "Executive Leadership",
      level: 0,
      parentId: null,
      headcount: null,
      automationShare: null,
      augmentationShare: 0.4,
      dominantRoles: [{ id: "11-1011.00", headcount: 200 }],
    },
    {
      id: "ops",
      name: "Operations",
      level: 1,
      parentId: "root",
      headcount: 800,
      automationShare: 0.55,
      augmentationShare: 0.25,
      dominantRoles: [{ id: "13-1051.00", headcount: 350 }],
    },
    {
      id: "eng",
      name: "Engineering",
      level: 1,
      parentId: "root",
      headcount: 400,
      automationShare: 0.32,
      augmentationShare: 0.6,
      dominantRoles: [{ id: "15-1252.00", headcount: 200 }],
    },
  ],
  roles: [
    {
      onetCode: "11-1011.00",
      title: "Chief Executives",
      normalizedTitle: "chief executives",
      parentCluster: "Executive Leadership",
      automationShare: 0.12,
      augmentationShare: 0.45,
      topTasks: [],
      notes: undefined,
      sources: [],
    },
    {
      onetCode: "13-1051.00",
      title: "Cost Estimators",
      normalizedTitle: "cost estimators",
      parentCluster: "Operations",
      automationShare: 0.61,
      augmentationShare: 0.22,
      topTasks: [],
      notes: undefined,
      sources: [],
    },
    {
      onetCode: "15-1252.00",
      title: "Software Developers",
      normalizedTitle: "software developers",
      parentCluster: "Engineering",
      automationShare: 0.18,
      augmentationShare: 0.71,
      topTasks: [],
      notes: undefined,
      sources: [],
    },
  ],
  aggregations: [],
  visualizationHints: {
    highlightRoleIds: ["15-1252.00"],
  },
};

test("buildOrgGraph indexes hierarchy and aggregates metrics", () => {
  const graph = buildOrgGraph(sampleReport);

  assert.equal(graph.nodes.size, 3);
  assert.ok(graph.nodes.has("root"));
  assert.equal(graph.roots.length, 1);

  const rootNode = graph.nodes.get("root");
  assert(rootNode);
  assert.equal(rootNode.aggregate.headcount, 1200);
  assert.equal(rootNode.aggregate.descendantCount, 2);
  assert.equal(graph.highlightRoleIds.has("15-1252.00".toLowerCase()), true);
  const opsNode = graph.nodes.get("ops");
  assert(opsNode);
  assert.equal(opsNode.roles[0]?.headcount, 350);
});

test("org flow model focuses roles and computes layout", () => {
  const graph = buildOrgGraph(sampleReport);
  const model = buildOrgFlowModel(graph, { maxRolesPerNode: 20 });
  assert.equal(model.nodes.length, 1);
  const rootNode = model.nodes[0];
  assert.equal(rootNode.id, "root");
  assert.equal(rootNode.data.kind, "denseRoleContainer");
  assert.equal(rootNode.data.denseRoles.length, 2);
  assert.equal(rootNode.data.isHighlighted, true);
  assert.equal(model.edges.length, 0);

  const layout = applyLayeredLayout(model.nodes, model.edges, { direction: model.direction });
  const laidOutNode = layout.nodes.find((node) => node.id === "root");
  assert(laidOutNode);
  assert.equal(typeof laidOutNode.position.x, "number");
  assert.equal(typeof laidOutNode.position.y, "number");
});

test("collapsed children are skipped along with their edges", () => {
const reportWithCollapse: EnrichedOrgReport = {
    ...sampleReport,
    visualizationHints: {
      ...(sampleReport.visualizationHints ?? {}),
      collapsedNodeIds: ["ops"],
    },
  };

  const graph = buildOrgGraph(reportWithCollapse);
  const model = buildOrgFlowModel(graph);

  const hasOpsNode = model.nodes.some((node) => node.id === "ops");
  assert.equal(hasOpsNode, false);

  const hasOpsEdge = model.edges.some((edge) => edge.target === "ops");
  assert.equal(hasOpsEdge, false);
});

test("dense role containers collapse child role nodes", () => {
  const denseReport: EnrichedOrgReport = {
    metadata: {
      companyName: "Compact Org",
      companySlug: "compact-org",
      lastUpdatedIso: new Date().toISOString(),
      sources: [],
    },
    hierarchy: [
      {
        id: "dept",
        name: "Operations",
        level: 0,
        parentId: null,
        headcount: null,
        automationShare: 0.5,
        augmentationShare: 0.3,
        dominantRoles: [],
      },
      {
        id: "role-a",
        name: "Warehouse Supervisors",
        level: 1,
        parentId: "dept",
        headcount: 120,
        automationShare: 0.22,
        augmentationShare: 0.41,
      dominantRoles: [{ id: "51-1011.00", headcount: 70 }],
      },
      {
        id: "role-b",
        name: "Inventory Specialists",
        level: 1,
        parentId: "dept",
        headcount: 80,
        automationShare: 0.36,
        augmentationShare: 0.28,
      dominantRoles: [{ id: "43-5061.00", headcount: 50 }],
      },
    ],
    roles: [
      {
        onetCode: "51-1011.00",
        title: "First-Line Supervisors of Production and Operating Workers",
        normalizedTitle: "first-line supervisors of production and operating workers",
        parentCluster: "Operations",
        headcount: 120,
        automationShare: 0.22,
        augmentationShare: 0.41,
        topTasks: [],
        taskMixCounts: { automation: 15, augmentation: 30, manual: 15 },
        taskMixShares: { automation: 0.25, augmentation: 0.5, manual: 0.25 },
        notes: undefined,
        sources: [],
      },
      {
        onetCode: "43-5061.00",
        title: "Production, Planning, and Expediting Clerks",
        normalizedTitle: "production, planning, and expediting clerks",
        parentCluster: "Operations",
        headcount: 80,
        automationShare: 0.36,
        augmentationShare: 0.28,
        topTasks: [],
        taskMixCounts: { automation: 10, augmentation: 5, manual: 25 },
        taskMixShares: { automation: 0.3, augmentation: 0.25, manual: 0.45 },
        notes: undefined,
        sources: [],
      },
    ],
    aggregations: [],
    visualizationHints: {},
  };

  const graph = buildOrgGraph(denseReport);
  const model = buildOrgFlowModel(graph);

  assert.equal(model.nodes.length, 1);
  const root = model.nodes[0];
  assert.equal(root.data.kind, "denseRoleContainer");
  assert.equal(root.data.denseRoles.length, 2);
  assert.equal(model.edges.length, 0);
  assert.equal(root.data.totalHeadcount, 200);
  const groupLabels = Array.from(new Set(root.data.denseRoles.map((role) => role.groupLabel)));
  assert.deepEqual(groupLabels, ["Warehouse Supervisors", "Inventory Specialists"]);
  const firstGroupRoles = root.data.denseRoles.filter((role) => role.groupId === "role-a");
  assert.equal(firstGroupRoles.length, 1);
  assert.equal(firstGroupRoles[0]?.groupHeadcount, 120);
  assert.deepEqual(firstGroupRoles[0]?.taskMixCounts, { automation: 15, augmentation: 30, manual: 15 });
  assert.deepEqual(firstGroupRoles[0]?.taskMixShares, { automation: 0.25, augmentation: 0.5, manual: 0.25 });

  const secondRole = root.data.denseRoles.find((role) => role.groupId === "role-b");
  assert.deepEqual(secondRole?.taskMixCounts, { automation: 10, augmentation: 5, manual: 25 });
  assert.deepEqual(secondRole?.taskMixShares, { automation: 0.3, augmentation: 0.25, manual: 0.45 });

  const preferredHeight = root.layout.preferredHeight;
  assert.equal(
    preferredHeight,
    getDenseNodePreferredHeight(root.data.denseRoles.length, 2)
  );
});

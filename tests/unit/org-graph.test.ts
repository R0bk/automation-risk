import test from "node:test";
import assert from "node:assert/strict";

import { buildOrgGraph } from "@/lib/run/org-graph";
import { buildOrgFlowModel } from "@/lib/run/org-flow-model";
import { applyLayeredLayout } from "@/lib/run/org-flow-layout";
import type { OrgReport } from "@/lib/run/report-schema";

const sampleReport: OrgReport = {
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
      dominantRoleIds: ["11-1011.00"],
    },
    {
      id: "ops",
      name: "Operations",
      level: 1,
      parentId: "root",
      headcount: 800,
      automationShare: 0.55,
      augmentationShare: 0.25,
      dominantRoleIds: ["13-1051.00"],
    },
    {
      id: "eng",
      name: "Engineering",
      level: 1,
      parentId: "root",
      headcount: 400,
      automationShare: 0.32,
      augmentationShare: 0.6,
      dominantRoleIds: ["15-1252.00"],
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
});

test("org flow model focuses roles and computes layout", () => {
  const graph = buildOrgGraph(sampleReport);
  const model = buildOrgFlowModel(graph, { maxRolesPerNode: 2 });
  assert.equal(model.nodes.length, 3);
  const engineeringNode = model.nodes.find((node) => node.id === "eng");
  assert(engineeringNode);
  assert.equal(engineeringNode.data.roles.length, 1);
  assert.equal(engineeringNode.data.isHighlighted, true);

  const layout = applyLayeredLayout(model.nodes, model.edges, { direction: model.direction });
  const laidOutNode = layout.nodes.find((node) => node.id === "eng");
  assert(laidOutNode);
  assert.equal(typeof laidOutNode.position.x, "number");
  assert.equal(typeof laidOutNode.position.y, "number");
});

test("collapsed children are skipped along with their edges", () => {
  const reportWithCollapse: OrgReport = {
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

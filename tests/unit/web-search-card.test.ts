import assert from "node:assert/strict";
import test from "node:test";

import { normalizeWebSearchAction } from "@/components/run/tooling/web-search-card";

test("normalizeWebSearchAction supports OpenAI web search payload", () => {
  const action = normalizeWebSearchAction({
    action: {
      type: "search",
      query: "OpenAI total employees headcount 2025",
    },
  });

  assert.ok(action);
  assert.equal(action?.kind, "search");
  assert.equal(action?.query, "OpenAI total employees headcount 2025");
});

test("normalizeWebSearchAction supports Anthropic web search payload", () => {
  const action = normalizeWebSearchAction({
    query: "OpenAI organizational structure departments",
  });

  assert.ok(action);
  assert.equal(action?.kind, "search");
  assert.equal(action?.query, "OpenAI organizational structure departments");
});

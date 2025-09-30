import test from "node:test";
import assert from "node:assert/strict";
import { slugifyCompanyName } from "@/lib/utils";

test("slugifyCompanyName trims and hyphenates", () => {
  const result = slugifyCompanyName("Open AI Labs");
  assert.equal(result, "open-ai-labs");
});

test("slugifyCompanyName removes punctuation", () => {
  const result = slugifyCompanyName("ACME & Co.");
  assert.equal(result, "acme-co");
});

test("slugifyCompanyName enforces max length", () => {
  const longName = "Very Long Corporation Name That Exceeds the Maximum Length We Support";
  const result = slugifyCompanyName(longName);
  assert.ok(result.length <= 80);
});

test("slugifyCompanyName falls back when empty", () => {
  const result = slugifyCompanyName("@@@");
  assert.ok(result.startsWith("org-"));
});

CREATE INDEX IF NOT EXISTS "AnalysisRun_company_createdAt_idx"
  ON "AnalysisRun" ("companyId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Message_v2_chatId_createdAt_idx"
  ON "Message_v2" ("chatId", "createdAt");

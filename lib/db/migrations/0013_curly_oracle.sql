CREATE INDEX IF NOT EXISTS "AnalysisRun_companyId_createdAt_idx" ON "AnalysisRun" USING btree ("companyId","createdAt" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AnalysisRun_status_idx" ON "AnalysisRun" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AnalysisRun_chatId_idx" ON "AnalysisRun" USING btree ("chatId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Message_v2_chatId_createdAt_idx" ON "Message_v2" USING btree ("chatId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "RunMetric_runId_idx" ON "RunMetric" USING btree ("runId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "RunMetric_metricType_idx" ON "RunMetric" USING btree ("metricType");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "RunPopularity_lastViewedAt_idx" ON "RunPopularity" USING btree ("lastViewedAt" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "RunRoleSnapshot_runId_idx" ON "RunRoleSnapshot" USING btree ("runId");
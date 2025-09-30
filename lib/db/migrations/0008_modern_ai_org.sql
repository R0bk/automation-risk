CREATE TABLE "Company" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "slug" varchar(128) NOT NULL,
  "displayName" varchar(256) NOT NULL,
  "hqCountry" varchar(64),
  "lastRunAt" timestamp
);

CREATE UNIQUE INDEX "Company_slug_key" ON "Company" ("slug");

CREATE TABLE "AnalysisRun" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" uuid NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "status" varchar(32) NOT NULL DEFAULT 'pending',
  "inputQuery" text NOT NULL,
  "model" varchar(64) NOT NULL,
  "finalReportJson" jsonb,
  "aiTrace" jsonb
);

CREATE TABLE "JobRole" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "onetCode" varchar(32) NOT NULL,
  "title" varchar(256) NOT NULL,
  "normalizedTitle" varchar(256) NOT NULL,
  "parentCluster" varchar(256),
  "isActive" boolean NOT NULL DEFAULT true,
  "metadata" jsonb
);

CREATE UNIQUE INDEX "JobRole_onetCode_key" ON "JobRole" ("onetCode");

CREATE TABLE "RunRoleSnapshot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "runId" uuid NOT NULL REFERENCES "AnalysisRun"("id") ON DELETE CASCADE,
  "jobRoleId" uuid NOT NULL REFERENCES "JobRole"("id") ON DELETE CASCADE,
  "hierarchyPath" jsonb NOT NULL,
  "headcount" integer,
  "automationRisk" numeric(6,3),
  "augmentationScore" numeric(6,3),
  "data" jsonb
);

CREATE TABLE "RunMetric" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "runId" uuid NOT NULL REFERENCES "AnalysisRun"("id") ON DELETE CASCADE,
  "metricType" varchar(64) NOT NULL,
  "label" varchar(256) NOT NULL,
  "headcount" integer,
  "automationRisk" numeric(6,3),
  "augmentationScore" numeric(6,3),
  "data" jsonb
);

CREATE TABLE "RunPopularity" (
  "runId" uuid PRIMARY KEY REFERENCES "AnalysisRun"("id") ON DELETE CASCADE,
  "viewCount" integer NOT NULL DEFAULT 0,
  "lastViewedAt" timestamp
);

CREATE TABLE "GlobalBudget" (
  "key" varchar(64) PRIMARY KEY,
  "remainingRuns" integer NOT NULL,
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

INSERT INTO "GlobalBudget" ("key", "remainingRuns")
VALUES ('company_runs', 50)
ON CONFLICT ("key") DO NOTHING;

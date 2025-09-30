CREATE TABLE IF NOT EXISTS "AnalysisRun" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"companyId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"inputQuery" text NOT NULL,
	"model" varchar(64) NOT NULL,
	"finalReportJson" jsonb,
	"aiTrace" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Company" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"slug" varchar(128) NOT NULL,
	"displayName" varchar(256) NOT NULL,
	"hqCountry" varchar(64),
	"lastRunAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "GlobalBudget" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"remainingRuns" integer NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "JobRole" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"onetCode" varchar(32) NOT NULL,
	"title" varchar(256) NOT NULL,
	"normalizedTitle" varchar(256) NOT NULL,
	"parentCluster" varchar(256),
	"isActive" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "JobRole_onetCode_unique" UNIQUE("onetCode")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "RunMetric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runId" uuid NOT NULL,
	"metricType" varchar(64) NOT NULL,
	"label" varchar(256) NOT NULL,
	"headcount" integer,
	"automationRisk" numeric(6, 3),
	"augmentationScore" numeric(6, 3),
	"data" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "RunPopularity" (
	"runId" uuid PRIMARY KEY NOT NULL,
	"viewCount" integer DEFAULT 0 NOT NULL,
	"lastViewedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "RunRoleSnapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runId" uuid NOT NULL,
	"jobRoleId" uuid NOT NULL,
	"hierarchyPath" jsonb NOT NULL,
	"headcount" integer,
	"automationRisk" numeric(6, 3),
	"augmentationScore" numeric(6, 3),
	"data" jsonb
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_companyId_Company_id_fk" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "RunMetric" ADD CONSTRAINT "RunMetric_runId_AnalysisRun_id_fk" FOREIGN KEY ("runId") REFERENCES "public"."AnalysisRun"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "RunPopularity" ADD CONSTRAINT "RunPopularity_runId_AnalysisRun_id_fk" FOREIGN KEY ("runId") REFERENCES "public"."AnalysisRun"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "RunRoleSnapshot" ADD CONSTRAINT "RunRoleSnapshot_runId_AnalysisRun_id_fk" FOREIGN KEY ("runId") REFERENCES "public"."AnalysisRun"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "RunRoleSnapshot" ADD CONSTRAINT "RunRoleSnapshot_jobRoleId_JobRole_id_fk" FOREIGN KEY ("jobRoleId") REFERENCES "public"."JobRole"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Company_slug_key" ON "Company" USING btree ("slug");
CREATE TABLE IF NOT EXISTS "AnalyticsSnapshot" (
  "key" varchar(64) PRIMARY KEY NOT NULL,
  "payload" jsonb NOT NULL,
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

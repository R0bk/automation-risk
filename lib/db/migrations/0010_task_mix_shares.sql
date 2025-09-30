ALTER TABLE "RunRoleSnapshot" RENAME COLUMN "automationRisk" TO "automationShare";
ALTER TABLE "RunRoleSnapshot" RENAME COLUMN "augmentationScore" TO "augmentationShare";

ALTER TABLE "RunMetric" RENAME COLUMN "automationRisk" TO "automationShare";
ALTER TABLE "RunMetric" RENAME COLUMN "augmentationScore" TO "augmentationShare";

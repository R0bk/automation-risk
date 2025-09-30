ALTER TABLE "AnalysisRun" ADD COLUMN "chatId" uuid NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "AnalysisRun" DROP COLUMN IF EXISTS "aiTrace";
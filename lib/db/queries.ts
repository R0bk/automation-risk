import "server-only";

import { and, asc, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ChatSDKError } from "../errors";
import { generateUUID } from "../utils";
import { parseWorkforceMetricData } from "../run/workforce-impact";
import {
  chat,
  company,
  analysisRun,
  jobRole,
  type JobRole,
  type DBMessage,
  message,
  runMetric,
  runPopularity,
  runRoleSnapshot,
  globalBudget,
  type User,
  user,
} from "./schema";

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

const ANALYST_SYSTEM_EMAIL = "analyst@system.local";

export async function getOrCreateAnalystUser(): Promise<User> {
  try {
    const [existing] = await db
      .select()
      .from(user)
      .where(eq(user.email, ANALYST_SYSTEM_EMAIL))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [created] = await db
      .insert(user)
      .values({ email: ANALYST_SYSTEM_EMAIL, password: null })
      .returning();

    return created;
  } catch (error) {
    const [fallback] = await db
      .select()
      .from(user)
      .where(eq(user.email, ANALYST_SYSTEM_EMAIL))
      .limit(1);

    if (fallback) {
      return fallback;
    }

    throw new ChatSDKError(
      "bad_request:database",
      "Failed to provision analyst system user"
    );
  }
}

export async function findJobRoleByCode(code: string): Promise<JobRole | null> {
  const trimmed = code.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const [role] = await db
      .select()
      .from(jobRole)
      .where(eq(jobRole.onetCode, trimmed))
      .limit(1);

    return role ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to lookup job role by O*NET code"
    );
  }
}

export async function searchJobRolesByPrefix(prefix: string, limit: number = 10): Promise<JobRole[]> {
  const trimmed = prefix.trim();
  if (!trimmed) {
    return [];
  }

  const pattern = `${trimmed}%`;

  try {
    return await db
      .select()
      .from(jobRole)
      .where(ilike(jobRole.onetCode, pattern))
      .orderBy(asc(jobRole.title))
      .limit(limit);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to search job roles by prefix"
    );
  }
}

export async function findJobRoleByNormalizedTitle(title: string): Promise<JobRole | null> {
  const normalized = title.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  try {
    const [role] = await db
      .select()
      .from(jobRole)
      .where(eq(jobRole.normalizedTitle, normalized))
      .limit(1);

    return role ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to lookup job role by normalized title"
    );
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db
      .insert(message)
      .values(messages)
      .onConflictDoNothing({ target: message.id });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save messages");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}


const COMPANY_BUDGET_KEY = "company_runs";
type CompanyRecord = typeof company.$inferSelect;
type AnalysisRunRecord = typeof analysisRun.$inferSelect;
type RunRoleSnapshotInsert = typeof runRoleSnapshot.$inferInsert;
type RunMetricInsert = typeof runMetric.$inferInsert;

export async function getCompanyBySlug(slug: string) {
  try {
    const [record] = await db
      .select()
      .from(company)
      .where(eq(company.slug, slug))
      .limit(1);

    return record ?? null;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get company");
  }
}

export async function getLatestRunForCompany(companyId: string) {
  try {
    const [record] = await db
      .select()
      .from(analysisRun)
      .where(eq(analysisRun.companyId, companyId))
      .orderBy(desc(analysisRun.createdAt))
      .limit(1);

    return record ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get analysis run"
    );
  }
}

export async function getAnalysisRunById(id: string) {
  try {
    const [record] = await db
      .select()
      .from(analysisRun)
      .where(eq(analysisRun.id, id))
      .limit(1);

    return record ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get analysis run by id"
    );
  }
}

export async function getRemainingCompanyRuns() {
  try {
    const [record] = await db
      .select({ remainingRuns: globalBudget.remainingRuns })
      .from(globalBudget)
      .where(eq(globalBudget.key, COMPANY_BUDGET_KEY))
      .limit(1);

    return record?.remainingRuns ?? 0;
  } catch (_error) {
    console.warn("Failed to read global budget counter", _error);
    return 0;
  }
}

export async function getRunPageDataBySlug(slug: string) {
  try {
    return await db.transaction(async (tx) => {
      const startedAt = Date.now();

      const [companyRow] = await tx
        .select({
          company,
          remainingRuns: globalBudget.remainingRuns,
        })
        .from(company)
        .leftJoin(globalBudget, eq(globalBudget.key, COMPANY_BUDGET_KEY))
        .where(eq(company.slug, slug))
        .limit(1);
      const afterCompanyMs = Date.now() - startedAt;

      const companyRecord = companyRow?.company ?? null;
      const remainingRunsValue = companyRow?.remainingRuns ?? 0;

      let latestRunRecord: AnalysisRunRecord | null = null;
      let messagesForRun: typeof message.$inferSelect[] = [];
      let metricsForRun: typeof runMetric.$inferSelect[] = [];
      let latestRunDurationMs = 0;
      let messagesDurationMs = 0;
      let metricsDurationMs = 0;

      if (companyRecord) {
        const beforeRun = Date.now();
        const [latestRun] = await tx
          .select()
          .from(analysisRun)
          .where(eq(analysisRun.companyId, companyRecord.id))
          .orderBy(desc(analysisRun.createdAt))
          .limit(1);
        latestRunDurationMs = Date.now() - beforeRun;

        latestRunRecord = latestRun ?? null;

        if (latestRun?.chatId) {
          const beforeMessages = Date.now();
          messagesForRun = await tx
            .select()
            .from(message)
            .where(eq(message.chatId, latestRun.chatId))
            .orderBy(asc(message.createdAt));
          messagesDurationMs = Date.now() - beforeMessages;
        }

        if (latestRun) {
          const beforeMetrics = Date.now();
          metricsForRun = await tx
            .select()
            .from(runMetric)
            .where(eq(runMetric.runId, latestRun.id));
          metricsDurationMs = Date.now() - beforeMetrics;
        }
      }

      const durationMs = Date.now() - startedAt;
      console.log("[getRunPageDataBySlug] timings", {
        slug,
        companyMs: afterCompanyMs,
        latestRunMs: latestRunDurationMs,
        messagesMs: messagesDurationMs,
        metricsMs: metricsDurationMs,
        messageCount: messagesForRun.length,
        totalMs: durationMs,
      });

      return {
        company: companyRecord,
        remainingRuns: remainingRunsValue,
        latestRun: latestRunRecord,
        messages: messagesForRun,
        metrics: metricsForRun,
      };
    });
  } catch (_error) {
    console.error("[getRunPageDataBySlug] failed", {
      slug,
      error: _error,
    });
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to load run page data"
    );
  }
}

export async function setRemainingCompanyRuns(value: number) {
  try {
    const now = new Date();

    const updated = await db
      .update(globalBudget)
      .set({
        remainingRuns: value,
        updatedAt: now,
      })
      .where(eq(globalBudget.key, COMPANY_BUDGET_KEY))
      .returning();

    if (updated.length > 0) {
      return updated[0];
    }

    const [inserted] = await db
      .insert(globalBudget)
      .values({
        key: COMPANY_BUDGET_KEY,
        remainingRuns: value,
        updatedAt: now,
      })
      .returning();

    return inserted;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to set global budget"
    );
  }
}

type CreateRunWithBudgetArgs = {
  slug: string;
  displayName: string;
  hqCountry?: string | null;
  inputQuery: string;
  model: string;
  bypassBudget?: boolean;
};

export async function createAnalysisRunWithBudget({
  slug,
  displayName,
  hqCountry,
  inputQuery,
  model,
  bypassBudget = false,
}: CreateRunWithBudgetArgs) {
  const analystUser = await getOrCreateAnalystUser();
  const now = new Date();

  return await db.transaction(async (tx) => {
    const [budgetRow] = await tx
      .select()
      .from(globalBudget)
      .where(eq(globalBudget.key, COMPANY_BUDGET_KEY))
      .limit(1)
      .for("update");

    if (!budgetRow) {
      throw new ChatSDKError(
        "not_found:budget",
        "Budget counter not configured"
      );
    }

    if (!bypassBudget && budgetRow.remainingRuns <= 0) {
      throw new ChatSDKError(
        "forbidden:budget_exhausted",
        "No remaining company runs"
      );
    }

    const [existingCompany] = await tx
      .select()
      .from(company)
      .where(eq(company.slug, slug))
      .limit(1)
      .for("update");

    let companyId: string;
    let companyRecord: Awaited<ReturnType<typeof getCompanyBySlug>>;

    if (existingCompany) {
      companyId = existingCompany.id;

      await tx
        .update(company)
        .set({
          displayName,
          hqCountry: hqCountry ?? existingCompany.hqCountry,
          updatedAt: now,
          lastRunAt: now,
        })
        .where(eq(company.id, companyId));

      companyRecord = {
        ...existingCompany,
        displayName,
        hqCountry: hqCountry ?? existingCompany.hqCountry,
        updatedAt: now,
        lastRunAt: now,
      };
    } else {
      const [createdCompany] = await tx
        .insert(company)
        .values({
          slug,
          displayName,
          hqCountry: hqCountry ?? null,
          createdAt: now,
          updatedAt: now,
          lastRunAt: now,
        })
        .returning();

      companyId = createdCompany.id;
      companyRecord = createdCompany;
    }

    const chatId = generateUUID();

    await tx.insert(chat).values({
      id: chatId,
      createdAt: now,
      userId: analystUser.id,
      title: displayName,
      visibility: "private",
    });

    const [run] = await tx
      .insert(analysisRun)
      .values({
        companyId,
        inputQuery,
        model,
        chatId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Only decrement budget if not using user's API key
    if (!bypassBudget) {
      await tx
        .update(globalBudget)
        .set({
          remainingRuns: budgetRow.remainingRuns - 1,
          updatedAt: now,
        })
        .where(eq(globalBudget.key, COMPANY_BUDGET_KEY));
    }

    return {
      run,
      company: companyRecord,
      chatId,
      remainingRuns: bypassBudget ? budgetRow.remainingRuns : budgetRow.remainingRuns - 1,
    };
  });
}

export async function updateAnalysisRunResult({
  runId,
  status,
  finalReportJson,
}: {
  runId: string;
  status: string;
  finalReportJson: unknown;
}) {
  try {
    await db
      .update(analysisRun)
      .set({
        status,
        finalReportJson,
        updatedAt: new Date(),
      })
      .where(eq(analysisRun.id, runId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update analysis run"
    );
  }
}

export async function updateAnalysisRunStatus(runId: string, status: string) {
  try {
    await db
      .update(analysisRun)
      .set({ status, updatedAt: new Date() })
      .where(eq(analysisRun.id, runId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update analysis run status"
    );
  }
}

export async function recordRunPopularity(runId: string) {
  try {
    const now = new Date();

    const updated = await db
      .update(runPopularity)
      .set({
        viewCount: sql`${runPopularity.viewCount} + 1`,
        lastViewedAt: now,
      })
      .where(eq(runPopularity.runId, runId))
      .returning();

    if (updated.length > 0) {
      return updated[0];
    }

    const [inserted] = await db
      .insert(runPopularity)
      .values({
        runId,
        viewCount: 1,
        lastViewedAt: now,
      })
      .returning();

    return inserted;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to record run popularity"
    );
  }
}

export async function listTrendingRuns(limit: number) {
  try {
    return await db
      .select({
        runId: analysisRun.id,
        companyId: analysisRun.companyId,
        status: analysisRun.status,
        createdAt: analysisRun.createdAt,
        updatedAt: analysisRun.updatedAt,
        finalReportJson: analysisRun.finalReportJson,
        slug: company.slug,
        displayName: company.displayName,
        hqCountry: company.hqCountry,
        lastRunAt: company.lastRunAt,
        viewCount: runPopularity.viewCount,
        lastViewedAt: runPopularity.lastViewedAt,
      })
      .from(analysisRun)
      .leftJoin(company, eq(analysisRun.companyId, company.id))
      .leftJoin(runPopularity, eq(runPopularity.runId, analysisRun.id))
      .where(eq(analysisRun.status, "completed"))
      .orderBy(desc(analysisRun.updatedAt), desc(analysisRun.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to list trending runs"
    );
  }
}

export async function listMostViewedRuns({
  limit,
  offset,
  searchTerm,
  sortBy = "views",
}: {
  limit: number;
  offset: number;
  searchTerm?: string;
  sortBy?: "views" | "impact";
}) {
  try {
    const effectiveLimit = Math.max(limit, 0);
    const effectiveOffset = Math.max(offset, 0);
    const popularityScore = sql<number>`COALESCE(${runPopularity.viewCount}, 0)`;
    const impactScoreExpr = sql<number>`CAST(${runMetric.data}->>'score' AS double precision)`;

    const trimmedSearch = searchTerm?.trim() ?? "";
    const conditions = [eq(analysisRun.status, "completed")];

    if (trimmedSearch.length > 0) {
      const pattern = `%${trimmedSearch}%`;
      conditions.push(
        or(ilike(company.displayName, pattern), ilike(company.slug, pattern))
      );
    }

    const whereClause =
      conditions.length === 1 ? conditions[0] : and(...conditions);

    const rows = await db
      .select({
        runId: analysisRun.id,
        status: analysisRun.status,
        updatedAt: analysisRun.updatedAt,
        slug: company.slug,
        displayName: company.displayName,
        hqCountry: company.hqCountry,
        viewCount: runPopularity.viewCount,
        impactScore: impactScoreExpr,
        workforceMetricData: runMetric.data,
      })
      .from(analysisRun)
      .leftJoin(company, eq(analysisRun.companyId, company.id))
      .leftJoin(runPopularity, eq(runPopularity.runId, analysisRun.id))
      .leftJoin(
        runMetric,
        and(eq(runMetric.runId, analysisRun.id), eq(runMetric.metricType, "workforce_score"))
      )
      .where(whereClause)
      .orderBy(
        sortBy === "impact"
          ? desc(sql`COALESCE(${impactScoreExpr}, -1)`)
          : desc(popularityScore),
        desc(analysisRun.updatedAt)
      )
      .limit(effectiveLimit + 1)
      .offset(effectiveOffset);

    const runs =
      effectiveLimit === 0
        ? []
        : rows.slice(0, effectiveLimit).map((row) => ({
            runId: row.runId,
            status: row.status,
            updatedAt: row.updatedAt,
            slug: row.slug,
            displayName: row.displayName,
            hqCountry: row.hqCountry,
            viewCount: row.viewCount,
            workforceMetric: parseWorkforceMetricData(row.workforceMetricData),
          }));
    const hasMore = rows.length > effectiveLimit;

    return {
      runs,
      hasMore,
    };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to list most viewed runs"
    );
  }
}

export async function saveRunRoleSnapshots(values: RunRoleSnapshotInsert[]) {
  try {
    if (values.length === 0) return;
    await db.insert(runRoleSnapshot).values(values);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save run role snapshots"
    );
  }
}

export async function saveRunMetrics(values: RunMetricInsert[]) {
  try {
    if (values.length === 0) return;
    await db.insert(runMetric).values(values);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save run metrics"
    );
  }
}

export async function getRunMetricsByRunId(runId: string) {
  try {
    return await db
      .select()
      .from(runMetric)
      .where(eq(runMetric.runId, runId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to load run metrics"
    );
  }
}

export async function listCompletedRunsWithReports() {
  try {
    return await db
      .select({
        runId: analysisRun.id,
        companyId: analysisRun.companyId,
        finalReportJson: analysisRun.finalReportJson,
        updatedAt: analysisRun.updatedAt,
      })
      .from(analysisRun)
      .where(and(eq(analysisRun.status, "completed"), isNotNull(analysisRun.finalReportJson)));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to list completed runs with reports"
    );
  }
}

export async function replaceRunMetrics(metricType: string, values: RunMetricInsert[]) {
  try {
    await db.transaction(async (tx) => {
      await tx.delete(runMetric).where(eq(runMetric.metricType, metricType));
      if (values.length > 0) {
        await tx.insert(runMetric).values(values);
      }
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to replace run metrics"
    );
  }
}

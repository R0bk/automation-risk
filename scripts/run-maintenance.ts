import { config } from "dotenv";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  analysisRun,
  chat,
  company,
  message,
  stream,
  runMetric,
  runRoleSnapshot,
  runPopularity,
} from "../lib/db/schema";

config({
  path: ".env.local",
});

if (!process.env.POSTGRES_URL) {
  console.error("POSTGRES_URL is not defined. Did you populate .env.local?");
  process.exit(1);
}

const rawArgs = process.argv.slice(2);
const [command, ...commandArgs] = rawArgs;

type FlagValue = string | boolean;

function parseFlags(args: string[]) {
  const flags: Record<string, FlagValue> = {};
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = args[i + 1];
    if (next == null || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }

  return { flags, positionals };
}

const { flags } = parseFlags(commandArgs);

const client = postgres(process.env.POSTGRES_URL, { max: 1 });
const db = drizzle(client);

type RunRow = {
  runId: string;
  chatId: string;
  companyId: string;
  displayName: string | null;
  slug: string | null;
  status: string;
  createdAt: Date;
};

async function listRuns({ listAll = false }: { listAll?: boolean } = {}) {
  const slug = typeof flags.slug === "string" ? flags.slug.trim() : undefined;
  let limit: number | undefined;

  if (typeof flags.limit === "string") {
    const parsed = Number.parseInt(flags.limit, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      console.error("--limit should be a positive number");
      process.exit(1);
    }
    limit = parsed;
  } else if (!listAll) {
    limit = 20;
  }

  const baseQuery = db
    .select({
      runId: analysisRun.id,
      chatId: analysisRun.chatId,
      companyId: analysisRun.companyId,
      displayName: company.displayName,
      slug: company.slug,
      status: analysisRun.status,
      createdAt: analysisRun.createdAt,
    })
    .from(analysisRun)
    .leftJoin(company, eq(analysisRun.companyId, company.id));

  const filteredQuery = slug
    ? baseQuery.where(eq(company.slug, slug))
    : baseQuery;

  const finalQuery =
    typeof limit === "number"
      ? filteredQuery.orderBy(desc(analysisRun.createdAt)).limit(limit)
      : filteredQuery.orderBy(desc(analysisRun.createdAt));

  const rows = await finalQuery;

  if (rows.length === 0) {
    console.log(
      slug
        ? `No runs found for slug "${slug}".`
        : "No runs found in the database."
    );
    return;
  }

  console.log(
    `Showing ${rows.length} run${rows.length === 1 ? "" : "s"}${
      slug ? ` for slug "${slug}"` : ""
    } (newest first):`
  );
  for (const [index, row] of rows.entries()) {
    const createdAt =
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt);
    console.log(
      `${index + 1}. ${createdAt} • ${row.status.padEnd(9)} • ${
        row.displayName ?? "(no name)"
      } • slug=${row.slug ?? "(none)"} • runId=${row.runId}`
    );
  }
}

async function resolveRunsForSlug(slug: string): Promise<RunRow[]> {
  const rows = await db
    .select({
      runId: analysisRun.id,
      chatId: analysisRun.chatId,
      companyId: analysisRun.companyId,
      displayName: company.displayName,
      slug: company.slug,
      status: analysisRun.status,
      createdAt: analysisRun.createdAt,
    })
    .from(analysisRun)
    .innerJoin(company, eq(analysisRun.companyId, company.id))
    .where(eq(company.slug, slug))
    .orderBy(desc(analysisRun.createdAt));

  return rows;
}

async function deleteRunById(runId: string) {
  const target = await loadRunById(runId);

  if (!target) {
    throw new Error(`Run ${runId} was not found.`);
  }

  await deleteRunsInternal([target]);

  console.log(
    `Deleted run ${runId} (${target.displayName ?? target.slug ?? "unknown"})`
  );
}

async function deleteRunsInternal(runs: RunRow[]) {
  if (runs.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  await db.transaction(async (tx) => {
    const companyIdsToRefresh = new Set<string>();

    for (const run of runs) {
      companyIdsToRefresh.add(run.companyId);

      // Delete in dependency order (children first, then parents)
      await tx.delete(message).where(eq(message.chatId, run.chatId));
      await tx.delete(stream).where(eq(stream.chatId, run.chatId));
      await tx.delete(runMetric).where(eq(runMetric.runId, run.runId));
      await tx.delete(runRoleSnapshot).where(eq(runRoleSnapshot.runId, run.runId));
      await tx.delete(runPopularity).where(eq(runPopularity.runId, run.runId));
      await tx.delete(analysisRun).where(eq(analysisRun.id, run.runId));
      await tx.delete(chat).where(eq(chat.id, run.chatId));
    }

    const now = new Date();

    for (const companyId of companyIdsToRefresh) {
      const [latest] = await tx
        .select({
          maxCreatedAt: sql<Date | null>`MAX(${analysisRun.createdAt})`,
        })
        .from(analysisRun)
        .where(eq(analysisRun.companyId, companyId));

      const lastRunAt = latest?.maxCreatedAt ?? null;

      await tx
        .update(company)
        .set({
          lastRunAt,
          updatedAt: now,
        })
        .where(eq(company.id, companyId));
    }
  });
}

async function deleteRuns() {
  const runId =
    typeof flags["run-id"] === "string" ? flags["run-id"].trim() : undefined;
  const slug =
    typeof flags.slug === "string" ? flags.slug.trim() : undefined;
  const keepLatest =
    typeof flags["keep-latest"] === "string"
      ? Number.parseInt(flags["keep-latest"], 10)
      : undefined;
  const olderThanDays =
    typeof flags["older-than-days"] === "string"
      ? Number.parseInt(flags["older-than-days"], 10)
      : undefined;
  const dryRun = flags["dry-run"] === true;

  if (!runId && !slug) {
    console.error("Provide either --run-id or --slug to delete runs.");
    process.exit(1);
  }

  if (runId) {
    if (dryRun) {
      const target = await loadRunById(runId);
      const label =
        target?.displayName ??
        target?.slug ??
        (target ? "run" : "unknown run");
      console.log(
        target
          ? `Dry run: would delete run ${runId} (${label}).`
          : `Dry run: run ${runId} would be deleted (lookup returned no metadata).`
      );
      return;
    }

    await deleteRunById(runId);
    return;
  }

  if (!slug) {
    console.error("Unable to resolve deletion target. Provide --slug.");
    process.exit(1);
  }

  const runs = await resolveRunsForSlug(slug);

  if (runs.length === 0) {
    console.log(`No runs found for slug "${slug}". Nothing to delete.`);
    return;
  }

  let candidates = runs;

  if (typeof keepLatest === "number" && keepLatest >= 0) {
    candidates = runs.slice(keepLatest);
  }

  if (typeof olderThanDays === "number" && olderThanDays >= 0) {
    const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
    candidates = candidates.filter(
      (run) =>
        run.createdAt instanceof Date && run.createdAt.getTime() < cutoff.getTime()
    );
  }

  if (candidates.length === 0) {
    console.log("No runs matched the deletion criteria.");
    return;
  }

  console.log(
    `${dryRun ? "Would delete" : "Deleting"} ${candidates.length} run${
      candidates.length === 1 ? "" : "s"
    } for slug "${slug}":`
  );
  for (const run of candidates) {
    const createdAt =
      run.createdAt instanceof Date
        ? run.createdAt.toISOString()
        : String(run.createdAt);
    console.log(
      ` • ${createdAt} • ${run.status} • ${run.displayName ?? "(no name)"} • runId=${run.runId}`
    );
  }

  if (dryRun) {
    return;
  }

  await deleteRunsInternal(candidates);

  console.log("Deletion complete.");
}

async function renameRuns() {
  const runId =
    typeof flags["run-id"] === "string" ? flags["run-id"].trim() : undefined;
  const slug =
    typeof flags.slug === "string" ? flags.slug.trim() : undefined;
  const newName =
    typeof flags.name === "string" ? flags.name.trim() : undefined;
  const newSlug =
    typeof flags["new-slug"] === "string" ? flags["new-slug"].trim() : undefined;
  const updateChats =
    flags["skip-chat-update"] === true ? false : true;
  const updateCompanyDisplayName = flags["update-company"] === true;

  if (!newName) {
    console.error("Provide --name with the desired title.");
    process.exit(1);
  }

  if (!runId && !slug) {
    console.error("Provide either --run-id or --slug to rename.");
    process.exit(1);
  }

  if (runId) {
    await renameSingleRun(runId, newName, updateCompanyDisplayName);
    return;
  }

  if (!slug) {
    console.error("Provide --slug when not renaming a single run.");
    process.exit(1);
  }

  await renameCompanyRuns(slug, newName, newSlug ?? null, updateChats);
}

async function renameSingleRun(
  runId: string,
  newTitle: string,
  updateCompany: boolean
) {
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({
        runId: analysisRun.id,
        chatId: analysisRun.chatId,
        companyId: analysisRun.companyId,
        displayName: company.displayName,
        slug: company.slug,
      })
      .from(analysisRun)
      .innerJoin(company, eq(analysisRun.companyId, company.id))
      .where(eq(analysisRun.id, runId))
      .limit(1);

    if (!target) {
      throw new Error(`Run ${runId} was not found.`);
    }

    await tx.update(chat).set({ title: newTitle }).where(eq(chat.id, target.chatId));

    if (updateCompany) {
      await tx
        .update(company)
        .set({ displayName: newTitle, updatedAt: new Date() })
        .where(eq(company.id, target.companyId));
    }

    if (updateCompany) {
      console.log(
        `Renamed run ${runId} to "${newTitle}" and updated the company display name.`
      );
    } else {
      console.log(`Renamed run ${runId} to "${newTitle}".`);
    }
  });
}

async function loadRunById(runId: string): Promise<RunRow | null> {
  const [row] = await db
    .select({
      runId: analysisRun.id,
      chatId: analysisRun.chatId,
      companyId: analysisRun.companyId,
      displayName: company.displayName,
      slug: company.slug,
      status: analysisRun.status,
      createdAt: analysisRun.createdAt,
    })
    .from(analysisRun)
    .innerJoin(company, eq(analysisRun.companyId, company.id))
    .where(eq(analysisRun.id, runId))
    .limit(1);

  return row ?? null;
}

async function renameCompanyRuns(
  slug: string,
  newName: string,
  newSlug: string | null,
  updateChats: boolean
) {
  await db.transaction(async (tx) => {
    const [targetCompany] = await tx
      .select()
      .from(company)
      .where(eq(company.slug, slug))
      .limit(1);

    if (!targetCompany) {
      throw new Error(`Company with slug "${slug}" was not found.`);
    }

    if (newSlug && newSlug !== slug) {
      const [existing] = await tx
        .select({ id: company.id })
        .from(company)
        .where(eq(company.slug, newSlug))
        .limit(1);
      if (existing) {
        throw new Error(
          `Cannot change slug to "${newSlug}" because it already exists.`
        );
      }
    }

    await tx
      .update(company)
      .set({
        displayName: newName,
        slug: newSlug ?? targetCompany.slug,
        updatedAt: new Date(),
      })
      .where(eq(company.id, targetCompany.id));

    if (updateChats) {
      const chatIds = await tx
        .select({ chatId: analysisRun.chatId })
        .from(analysisRun)
        .where(eq(analysisRun.companyId, targetCompany.id));

      if (chatIds.length > 0) {
        await tx
          .update(chat)
          .set({ title: newName })
          .where(inArray(chat.id, chatIds.map((row) => row.chatId)));
      }
    }
  });

  console.log(
    `Updated company "${slug}" to "${newName}"${
      newSlug && newSlug !== slug ? ` (new slug: ${newSlug})` : ""
    }${updateChats ? " and refreshed chat titles." : "."}`
  );
}

async function main() {
  try {
    switch (command) {
      case "list":
      case "ls": {
        await listRuns({ listAll: command === "ls" });
        break;
      }
      case "delete": {
        await deleteRuns();
        break;
      }
      case "rename": {
        await renameRuns();
        break;
      }
      case "help":
      case undefined: {
        printHelp();
        break;
      }
      default: {
        console.error(`Unknown command "${command}".`);
        printHelp();
        process.exit(1);
      }
    }
  } catch (error) {
    console.error("Operation failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.end({ timeout: 5 });
  }
}

function printHelp() {
  console.log(`Usage: pnpm tsx scripts/run-maintenance.ts <command> [options]

Commands:
  list --slug <slug> [--limit 20]             Show the newest runs (optionally filtered by slug).
  ls [--slug <slug>]                          List every run (no limit unless --limit is supplied).
  delete (--run-id <uuid> | --slug <slug>)    Delete a single run or many for a company.
         [--keep-latest <n>] [--older-than-days <d>] [--dry-run]
  rename (--run-id <uuid> | --slug <slug>)    Rename a run or company title.
         --name <text> [--new-slug <slug>] [--skip-chat-update] [--update-company]

Examples:
  pnpm tsx scripts/run-maintenance.ts list --slug acme-co
  pnpm tsx scripts/run-maintenance.ts delete --slug acme-co --keep-latest 1 --older-than-days 30
  pnpm tsx scripts/run-maintenance.ts rename --slug acme-co --name "Acme Corp"
  pnpm tsx scripts/run-maintenance.ts rename --run-id <uuid> --name "Acme – April Run"
`);
}

void main();

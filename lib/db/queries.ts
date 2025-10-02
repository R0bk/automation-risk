import "server-only";

import {
  // and,
  asc,
  // count,
  desc,
  eq,
  // gt,
  // gte,
  // inArray,
  ilike,
  // lt,
  sql,
  // type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// import type { ArtifactKind } from "@/components/artifact";
// import type { VisibilityType } from "@/components/visibility-selector";
import { ChatSDKError } from "../errors";
// import type { AppUsage } from "../usage";
import { generateUUID } from "../utils";
import {
  // type Chat,
  chat,
  company,
  analysisRun,
  jobRole,
  type JobRole,
  type DBMessage,
  // document,
  message,
  runMetric,
  runPopularity,
  runRoleSnapshot,
  globalBudget,
  // type Suggestion,
  // stream,
  // suggestion,
  type User,
  user,
  // vote,
} from "./schema";
import { generateHashedPassword } from "./utils";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

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

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create guest user"
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

// export async function saveChat({
//   id,
//   userId,
//   title,
//   visibility,
// }: {
//   id: string;
//   userId: string;
//   title: string;
//   visibility: VisibilityType;
// }) {
//   try {
//     return await db.insert(chat).values({
//       id,
//       createdAt: new Date(),
//       userId,
//       title,
//       visibility,
//     });
//   } catch (_error) {
//     throw new ChatSDKError("bad_request:database", "Failed to save chat");
//   }
// }

// export async function deleteChatById({ id }: { id: string }) {
//   try {
//     await db.delete(vote).where(eq(vote.chatId, id));
//     await db.delete(message).where(eq(message.chatId, id));
//     await db.delete(stream).where(eq(stream.chatId, id));

//     const [chatsDeleted] = await db
//       .delete(chat)
//       .where(eq(chat.id, id))
//       .returning();
//     return chatsDeleted;
//   } catch (_error) {
//     throw new ChatSDKError(
//       "bad_request:database",
//       "Failed to delete chat by id"
//     );
//   }
// }

// export async function getChatsByUserId({
//   id,
//   limit,
//   startingAfter,
//   endingBefore,
// }: {
//   id: string;
//   limit: number;
//   startingAfter: string | null;
//   endingBefore: string | null;
// }) {
//   try {
//     const extendedLimit = limit + 1;

//     const query = (whereCondition?: SQL<any>) =>
//       db
//         .select()
//         .from(chat)
//         .where(
//           whereCondition
//             ? and(whereCondition, eq(chat.userId, id))
//             : eq(chat.userId, id)
//         )
//         .orderBy(desc(chat.createdAt))
//         .limit(extendedLimit);

//     let filteredChats: Chat[] = [];

//     if (startingAfter) {
//       const [selectedChat] = await db
//         .select()
//         .from(chat)
//         .where(eq(chat.id, startingAfter))
//         .limit(1);

//       if (!selectedChat) {
//         throw new ChatSDKError(
//           "not_found:database",
//           `Chat with id ${startingAfter} not found`
//         );
//       }

//       filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
//     } else if (endingBefore) {
//       const [selectedChat] = await db
//         .select()
//         .from(chat)
//         .where(eq(chat.id, endingBefore))
//         .limit(1);

//       if (!selectedChat) {
//         throw new ChatSDKError(
//           "not_found:database",
//           `Chat with id ${endingBefore} not found`
//         );
//       }

//       filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
//     } else {
//       filteredChats = await query();
//     }

//     const hasMore = filteredChats.length > limit;

//     return {
//       chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
//       hasMore,
//     };
//   } catch (_error) {
//     throw new ChatSDKError(
//       "bad_request:database",
//       "Failed to get chats by user id"
//     );
//   }
// }

// export async function getChatById({ id }: { id: string }) {
//   try {
//     const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
//     if (!selectedChat) {
//       return null;
//     }

//     return selectedChat;
//   } catch (_error) {
//     throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
//   }
// }

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

// export async function voteMessage({
//   chatId,
//   messageId,
//   type,
// }: {
//   chatId: string;
//   messageId: string;
//   type: "up" | "down";
// }) {
//   try {
//     const [existingVote] = await db
//       .select()
//       .from(vote)
//       .where(and(eq(vote.messageId, messageId)));

//     if (existingVote) {
//       return await db
//         .update(vote)
//         .set({ isUpvoted: type === "up" })
//         .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
//     }
//     return await db.insert(vote).values({
//       chatId,
//       messageId,
//       isUpvoted: type === "up",
//     });
//   } catch (_error) {
//     throw new ChatSDKError("bad_request:database", "Failed to vote message");
//   }
// }

// export async function getVotesByChatId({ id }: { id: string }) {
//   try {
//     return await db.select().from(vote).where(eq(vote.chatId, id));
//   } catch (_error) {
//     throw new ChatSDKError(
//       "bad_request:database",
//       "Failed to get votes by chat id"
//     );
//   }
// }

// export async function saveDocument({
//   id,
//   title,
//   kind,
//   content,
//   userId,
// }: {
//   id: string;
//   title: string;
//   kind: ArtifactKind;
//   content: string;
//   userId: string;
// }) {
//   try {
//     return await db
//       .insert(document)
//       .values({
//         id,
//         title,
//         kind,
//         content,
//         userId,
//         createdAt: new Date(),
//       })
//       .returning();
//   } catch (_error) {
//     throw new ChatSDKError("bad_request:database", "Failed to save document");
//   }
// }

// export async function getDocumentsById({ id }: { id: string }) {
//   try {
//     const documents = await db
//       .select()
//       .from(document)
//       .where(eq(document.id, id))
//       .orderBy(asc(document.createdAt));

//     return documents;
//   } catch (_error) {
//     throw new ChatSDKError(
//       "bad_request:database",
//       "Failed to get documents by id"
//     );
//   }
// }

// export async function getDocumentById({ id }: { id: string }) {
//   try {
//     const [selectedDocument] = await db
//       .select()
//       .from(document)
//       .where(eq(document.id, id))
//       .orderBy(desc(document.createdAt));

//     return selectedDocument;
//   } catch (_error) {
//     throw new ChatSDKError(
//       "bad_request:database",
//       "Failed to get document by id"
//     );
//   }
// }

// export async function deleteDocumentsByIdAfterTimestamp({
//   id,
//   timestamp,
// }: {
//   id: string;
//   timestamp: Date;
// }) {
//   try {
//     await db
//       .delete(suggestion)
//       .where(
//         and(
//           eq(suggestion.documentId, id),
//           gt(suggestion.documentCreatedAt, timestamp)
//         )
//       );

//     return await db
//       .delete(document)
//       .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
//       .returning();
//   } catch (_error) {
//     throw new ChatSDKError(
//       "bad_request:database",
//       "Failed to delete documents by id after timestamp"
//     );
//   }
// }

// export async function saveSuggestions({
//   suggestions,
// }: {
//   suggestions: Suggestion[];
// }) {
//   try {
//     return await db.insert(suggestion).values(suggestions);
//   } catch (_error) {
//     throw new ChatSDKError(
//       "bad_request:database",
//       "Failed to save suggestions"
//     );
//   }
// }

// export async function getSuggestionsByDocumentId({
//   documentId,
// }: {
//   documentId: string;
// }) {
//   try {
//     return await db
//       .select()
//       .from(suggestion)
//       .where(and(eq(suggestion.documentId, documentId)));
//   } catch (_error) {
//     throw new ChatSDKError(
//       "bad_request:database",
//       "Failed to get suggestions by document id"
//     );
//   }
// }

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

// export async function deleteMessagesByChatIdAfterTimestamp({
//   chatId,
//   timestamp,
// }: {
//   chatId: string;
//   timestamp: Date;
// }) {
//   try {
//     const messagesToDelete = await db
//       .select({ id: message.id })
//       .from(message)
//       .where(
//         and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
//       );

//     const messageIds = messagesToDelete.map(
//       (currentMessage) => currentMessage.id
//     );

//     if (messageIds.length > 0) {
//       await db
//         .delete(vote)
//         .where(
//           and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
//         );

//       return await db
//         .delete(message)
//         .where(
//           and(eq(message.chatId, chatId), inArray(message.id, messageIds))
//         );
//     }
//   } catch (_error) {
//     throw new ChatSDKError(
//       "bad_request:database",
//       "Failed to delete messages by chat id after timestamp"
//     );
//   }
// }

// export async function updateChatVisiblityById({
//   chatId,
//   visibility,
// }: {
//   chatId: string;
//   visibility: "private" | "public";
// }) {
//   try {
//     return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
//   } catch (_error) {
//     throw new ChatSDKError(
//       "bad_request:database",
//       "Failed to update chat visibility by id"
//     );
//   }
// }

// export async function updateChatLastContextById({
//   chatId,
//   context,
// }: {
//   chatId: string;
//   // Store merged server-enriched usage object
//   context: AppUsage;
// }) {
//   try {
//     return await db
//       .update(chat)
//       .set({ lastContext: context })
//       .where(eq(chat.id, chatId));
//   } catch (error) {
//     console.warn("Failed to update lastContext for chat", chatId, error);
//     return;
//   }
// }

// export async function getMessageCountByUserId({
//   id,
//   differenceInHours,
// }: {
//   id: string;
//   differenceInHours: number;
// }) {
//   try {
//     const twentyFourHoursAgo = new Date(
//       Date.now() - differenceInHours * 60 * 60 * 1000
//     );

//     const [stats] = await db
//       .select({ count: count(message.id) })
//       .from(message)
//       .innerJoin(chat, eq(message.chatId, chat.id))
//       .where(
//         and(
//           eq(chat.userId, id),
//           gte(message.createdAt, twentyFourHoursAgo),
//           eq(message.role, "user")
//         )
//       )
//       .execute();

//     return stats?.count ?? 0;
//   } catch (_error) {
//     throw new ChatSDKError(
//       "bad_request:database",
//       "Failed to get message count by user id"
//     );
//   }
// }

// export async function createStreamId({
//   streamId,
//   chatId,
// }: {
//   streamId: string;
//   chatId: string;
// }) {
//   try {
//     await db
//       .insert(stream)
//       .values({ id: streamId, chatId, createdAt: new Date() });
//   } catch (_error) {
//     throw new ChatSDKError(
//       "bad_request:database",
//       "Failed to create stream id"
//     );
//   }
// }

// export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
//   try {
//     const streamIds = await db
//       .select({ id: stream.id })
//       .from(stream)
//       .where(eq(stream.chatId, chatId))
//       .orderBy(asc(stream.createdAt))
//       .execute();

//     return streamIds.map(({ id }) => id);
//   } catch (_error) {
//     throw new ChatSDKError(
//       "bad_request:database",
//       "Failed to get stream ids by chat id"
//     );
//   }
// }

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
};

export async function createAnalysisRunWithBudget({
  slug,
  displayName,
  hqCountry,
  inputQuery,
  model,
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

    if (budgetRow.remainingRuns <= 0) {
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

    await tx
      .update(globalBudget)
      .set({
        remainingRuns: budgetRow.remainingRuns - 1,
        updatedAt: now,
      })
      .where(eq(globalBudget.key, COMPANY_BUDGET_KEY));

    return {
      run,
      company: companyRecord,
      chatId,
      remainingRuns: budgetRow.remainingRuns - 1,
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
}: {
  limit: number;
  offset: number;
}) {
  try {
    const effectiveLimit = Math.max(limit, 0);
    const effectiveOffset = Math.max(offset, 0);
    const popularityScore = sql<number>`COALESCE(${runPopularity.viewCount}, 0)`;

    const rows = await db
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
      .orderBy(desc(popularityScore), desc(analysisRun.updatedAt))
      .limit(effectiveLimit + 1)
      .offset(effectiveOffset);

    const runs = effectiveLimit === 0 ? [] : rows.slice(0, effectiveLimit);
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

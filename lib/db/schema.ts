import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  integer,
  json,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AppUsage } from "../usage";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  lastContext: jsonb("lastContext").$type<AppUsage | null>(),
});

export type Chat = InferSelectModel<typeof chat>;

export const company = pgTable(
  "Company",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    slug: varchar("slug", { length: 128 }).notNull(),
    displayName: varchar("displayName", { length: 256 }).notNull(),
    hqCountry: varchar("hqCountry", { length: 64 }),
    lastRunAt: timestamp("lastRunAt"),
  },
  (table) => ({
    slugIndex: uniqueIndex("Company_slug_key").on(table.slug),
  })
);

export type Company = InferSelectModel<typeof company>;

export const analysisRun = pgTable("AnalysisRun", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  companyId: uuid("companyId")
    .notNull()
    .references(() => company.id),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  status: varchar("status", { length: 32 })
    .notNull()
    .default("pending"),
  inputQuery: text("inputQuery").notNull(),
  model: varchar("model", { length: 64 }).notNull(),
  finalReportJson: jsonb("finalReportJson"),
});

export type AnalysisRun = InferSelectModel<typeof analysisRun>;

export const jobRole = pgTable("JobRole", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  onetCode: varchar("onetCode", { length: 32 }).notNull().unique(),
  title: varchar("title", { length: 256 }).notNull(),
  normalizedTitle: varchar("normalizedTitle", { length: 256 }).notNull(),
  parentCluster: varchar("parentCluster", { length: 256 }),
  isActive: boolean("isActive").notNull().default(true),
  metadata: jsonb("metadata"),
});

export type JobRole = InferSelectModel<typeof jobRole>;

export const runRoleSnapshot = pgTable("RunRoleSnapshot", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  runId: uuid("runId")
    .notNull()
    .references(() => analysisRun.id),
  jobRoleId: uuid("jobRoleId")
    .notNull()
    .references(() => jobRole.id),
  hierarchyPath: jsonb("hierarchyPath").notNull(),
  headcount: integer("headcount"),
  automationShare: numeric("automationShare", { precision: 6, scale: 3 }),
  augmentationShare: numeric("augmentationShare", { precision: 6, scale: 3 }),
  data: jsonb("data"),
});

export type RunRoleSnapshot = InferSelectModel<typeof runRoleSnapshot>;

export const runMetric = pgTable("RunMetric", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  runId: uuid("runId")
    .notNull()
    .references(() => analysisRun.id),
  metricType: varchar("metricType", { length: 64 }).notNull(),
  label: varchar("label", { length: 256 }).notNull(),
  headcount: integer("headcount"),
  automationShare: numeric("automationShare", { precision: 6, scale: 3 }),
  augmentationShare: numeric("augmentationShare", { precision: 6, scale: 3 }),
  data: jsonb("data"),
});

export type RunMetric = InferSelectModel<typeof runMetric>;

export const runPopularity = pgTable("RunPopularity", {
  runId: uuid("runId")
    .primaryKey()
    .references(() => analysisRun.id),
  viewCount: integer("viewCount").notNull().default(0),
  lastViewedAt: timestamp("lastViewedAt"),
});

export type RunPopularity = InferSelectModel<typeof runPopularity>;

export const globalBudget = pgTable("GlobalBudget", {
  key: varchar("key", { length: 64 }).primaryKey().notNull(),
  remainingRuns: integer("remainingRuns").notNull(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type GlobalBudget = InferSelectModel<typeof globalBudget>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable("Message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  "Vote",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

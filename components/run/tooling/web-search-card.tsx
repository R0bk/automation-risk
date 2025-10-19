import { ToolContainer } from "@/components/run/tooling/tool-container";
import { Globe } from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";

type ToolState = "input-streaming" | "input-available" | "output-available" | "output-error";

export interface WebSearchCardProps {
  args?: unknown;
  result?: unknown;
  title?: string;
  state?: ToolState;
  error?: string;
}

const webSearchActionSchema = z.union([
  z.object({ type: z.literal("search"), query: z.string().nullish() }),
  z.object({ type: z.literal("open_page"), url: z.string() }),
  z.object({ type: z.literal("find"), url: z.string(), pattern: z.string() }),
]);

const webSearchCallSchema = z.object({
  action: webSearchActionSchema.nullish(),
});

const webSearchResultSchema = z
  .object({ status: z.string().optional() })
  .catchall(z.unknown());

const anthropicCallSchema = z
  .object({
    query: z.string().optional(),
    url: z.string().optional(),
    pattern: z.string().optional(),
    type: z.string().optional(),
  })
  .catchall(z.unknown());

const anthropicOutputSchema = z
  .object({
    url: z.string().optional(),
    title: z.string().optional(),
  })
  .catchall(z.unknown());

type NormalizedAction =
  | { kind: "search"; query?: string | null }
  | { kind: "open"; url?: string | null }
  | { kind: "find"; url?: string | null; pattern?: string | null };

const parseJson = (value: unknown) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const parseCall = (value: unknown) => {
  const parsed = webSearchCallSchema.safeParse(parseJson(value));
  return parsed.success ? parsed.data : null;
};

const parseResult = (value: unknown) => {
  const parsed = webSearchResultSchema.safeParse(parseJson(value));
  return parsed.success ? parsed.data : null;
};

const parseAnthropicCall = (value: unknown) => {
  const parsed = anthropicCallSchema.safeParse(parseJson(value));
  return parsed.success ? parsed.data : null;
};

const parseAnthropicResults = (value: unknown) => {
  const parsedValue = parseJson(value);
  if (!Array.isArray(parsedValue)) {
    return null;
  }
  const parsed = z.array(anthropicOutputSchema).safeParse(parsedValue);
  return parsed.success ? parsed.data : null;
};

const normalizeWebSearchAction = (args: unknown): NormalizedAction | null => {
  const call = parseCall(args);
  const action = call?.action ?? null;
  if (action) {
    switch (action.type) {
      case "search":
        return { kind: "search", query: action.query ?? undefined };
      case "open_page":
        return { kind: "open", url: action.url };
      case "find":
        return { kind: "find", url: action.url, pattern: action.pattern };
      default:
        return null;
    }
  }

  const anthropicCall = parseAnthropicCall(args);
  if (!anthropicCall) return null;

  if (anthropicCall.query) {
    return { kind: "search", query: anthropicCall.query };
  }

  if (anthropicCall.url && anthropicCall.pattern) {
    return { kind: "find", url: anthropicCall.url, pattern: anthropicCall.pattern };
  }

  if (anthropicCall.url) {
    return { kind: "open", url: anthropicCall.url };
  }

  return null;
};

const formatHighlight = (value?: string | null): ReactNode => {
  if (!value) return null;
  return (
    <span className="ml-2 truncate text-xs font-normal text-gray-500">
      {value}
    </span>
  );
};

const renderAction = (normalized: NormalizedAction | null, state: ToolState): ReactNode => {
  if (!normalized) {
    return state === "output-error" ? "Web search failed" : "Web search";
  }

  switch (normalized.kind) {
    case "search": {
      const verb = state === "output-available" ? "Searched" : state === "output-error" ? "Search" : "Searching";
      return (
        <>
          <span className="shrink-0">{verb}</span>
          {formatHighlight(normalized.query)}
        </>
      );
    }
    case "open":
      return (
        <>
          <span className="shrink-0">Open page</span>
          {formatHighlight(normalized.url)}
        </>
      );
    case "find":
      return (
        <>
          <span className="shrink-0">Find</span>
          {formatHighlight(normalized.pattern)}
          {normalized.url ? (
            <>
              <span className="ml-1 shrink-0">in</span>
              {formatHighlight(normalized.url)}
            </>
          ) : null}
        </>
      );
    default:
      return "Web search";
  }
};

const summarizeResults = (
  state: ToolState,
  action: NormalizedAction | null,
  result: unknown,
  error?: string,
): string | undefined => {
  if (state === "output-error") {
    return error ?? "error";
  }

  if (state !== "output-available") {
    return action ? "pending" : undefined;
  }

  const anthropicResults = parseAnthropicResults(result);
  if (anthropicResults && anthropicResults.length > 0) {
    const count = anthropicResults.length;
    return count === 1 ? "1 result" : `${count} results`;
  }

  const parsed = parseResult(result);
  if (parsed?.status) {
    return parsed.status;
  }

  return undefined;
};

export { normalizeWebSearchAction };

export function WebSearchCard({
  args,
  result,
  title = "Web search",
  state = "input-available",
  error,
}: WebSearchCardProps) {
  const normalizedAction = normalizeWebSearchAction(args);
  const statusLabel = summarizeResults(state, normalizedAction, result, error);
  const showTitle = title && title !== "Web search";

  return (
    <ToolContainer toolState={state}>
      <div className="flex items-center justify-between w-full gap-2">
        <div className="flex items-center w-0 flex-1 min-w-0">
          <Globe className="m-0.5 size-3 shrink-0" />
          <p className="ml-1 font-medium w-0 flex-1 min-w-0">{renderAction(normalizedAction, state)}</p>
        </div>
        {statusLabel && (
          <span className="shrink-0 rounded-full bg-[rgba(38,37,30,0.08)] px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-[rgba(38,37,30,0.6)]">
            {statusLabel}
          </span>
        )}
      </div>
      {showTitle && (
        <p className="mt-1 text-[10px] uppercase truncate inline-block tracking-[0.2em] text-[rgba(38,37,30,0.45)]">
          {title}
        </p>
      )}
    </ToolContainer>
  );
}

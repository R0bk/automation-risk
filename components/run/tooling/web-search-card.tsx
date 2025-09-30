import { ToolContainer } from "@/components/run/tooling/tool-container";
import { Globe } from "lucide-react";
import { z } from "zod";

interface WebSearchCardProps {
  args?: unknown;
  result?: unknown;
  title?: string;
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

const renderAction = (action: z.infer<typeof webSearchActionSchema> | null) => {
  if (!action) {
    return "Waiting for web search action...";
  }

  switch (action.type) {
    case "search":
      return action.query && action.query.length > 0
        ? <span>Searched <span className="ml-2 font-normal text-xs text-gray-500">{action.query}</span></span>
        : <span>Search</span>;
    case "open_page":
      return <span>Open page <span className="ml-2 font-normal text-xs text-gray-500">{action.url}</span></span>;
    case "find":
      return <span>Find <span className="ml-2 font-normal text-xs text-gray-500">{action.pattern}</span> in <span className="ml-2 font-normal text-xs text-gray-500">{action.url}</span></span>;
    default:
      return <span>Web search action</span>;
  }
};

export function WebSearchCard({ args, result, title = "Web search" }: WebSearchCardProps) {
  const call = parseCall(args);
  const action = call?.action ?? null;
  // const parsedResult = parseResult(result);
  // const statusLabel = parsedResult?.status ?? (action ? "pending" : undefined);

  return (
    // <div className="rounded-lg border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.7)] p-2 text-xs text-[rgba(38,37,30,0.68)]">
    <ToolContainer toolState="input-available">
      <div className="flex items-center">
        {/* <span className="font-semibold uppercase tracking-[0.3em] text-[rgba(38,37,30,0.55)]">
          {title}
        </span> */}
        <Globe className="size-3 min-w-3 m-0.5" />
        <p className="font-medium ml-1">{renderAction(action)}</p>
        {/* {statusLabel && (
          <span className="rounded-full bg-[rgba(38,37,30,0.08)] px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-[rgba(38,37,30,0.5)]">
            {statusLabel}
          </span>
        )} */}
      </div>
    </ToolContainer>
    // </div>
  );
}
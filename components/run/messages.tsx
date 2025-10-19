import React from "react";
import type { ChatMessage } from "@/lib/types";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Streamdown } from "streamdown";
import { isToolPart, ToolRenderer } from "./toolRouter";
import { ReasoningAsThinkingToolMemo } from "@/components/run/tooling/thinking-tool";

interface RunMessageListProps {
  messages: ChatMessage[];
  statusBar?: React.ReactNode;
}

const RunMessageList: React.FC<RunMessageListProps> = ({ messages, statusBar }) => {
  if (!messages.length) return null;
  if (!messages[0].parts.length) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <div className="mb-6 space-y-3 relative">
        {messages.map((message) => {
          if (message.role !== "assistant") return null;

          return (
            <article
              key={message.id}
              className="flex flex-col items-center rounded-xl border border-[rgba(38,37,30,0.12)] bg-[rgba(255,255,255,0.75)] px-4 py-3 text-sm text-[rgba(38,37,30,0.72)] shadow-[0_6px_14px_rgba(34,28,20,0.08)]"
            >
              <div className="w-full max-w-full justify-start sm:max-w-[860px]">
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  return (
                    <Streamdown key={`${message.id}-text-${index}`} >
                      {part.text}
                    </Streamdown>
                  );
                }

                if (part.type === "reasoning") {
                  return (
                    <div className="py-[6px]" key={`${message.id}-reasoning-${index}`}>
                      <ReasoningAsThinkingToolMemo part={part} id={`${message.id}-reasoning-${index}`} />
                    </div>
                  );
                }

                if (isToolPart(part)) {
                  return (
                    <div className="py-[6px]" key={`tool-${message.id}-${index}`}>
                      <ToolRenderer part={part} />
                    </div>
                  );
                }

                return null;
              })}
              </div>
            </article>
          );
        })}
        {statusBar}
      </div>
    </TooltipProvider>
  );
};

export const GroupedMessages: React.FC<{ messages: ChatMessage[], statusBar?: React.ReactNode }> = ({ messages, statusBar }) => {
  console.log("Messages", messages);
  const grouped = React.useMemo(() => messages.map(groupConsecutiveReasoningParts), [messages]);
  return <RunMessageList messages={grouped} statusBar={statusBar} />;
};

export { RunMessageList };

export type ReasoningPart = Extract<ChatMessage["parts"][number], { type: "reasoning" }>;

export function groupConsecutiveReasoningParts(message: ChatMessage): ChatMessage {
  const parts = message.parts ?? [];
  const grouped: ChatMessage["parts"][number][] = [];
  let i = 0;
  while (i < parts.length) {
    const part = parts[i];
    if (part.type === "reasoning") {
      let combined = part.text;
      let end = i;
      let j = i + 1;
      while (j < parts.length && parts[j].type === "reasoning") {
        combined += "\n\n&nbsp;\n\n" + (parts[j] as ReasoningPart).text;
        end = j;
        j += 1;
      }
      grouped.push({ type: "reasoning", text: combined, state: (parts[end] as ReasoningPart).state });
      i = end + 1;
      continue;
    }
    grouped.push(part);
    i += 1;
  }
  return { ...message, parts: grouped };
}

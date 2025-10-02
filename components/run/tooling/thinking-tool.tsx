import { Scroller } from "@/components/ui/scroller";
import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useRef, useState, memo, useMemo } from "react";

import { PulsingDot } from "@/components/run/pulsing-dot";
import { Streamdown } from 'streamdown';
import { TextShimmer } from "../../text-shimmer";
import type { ChatMessage } from "@/lib/types";
import { ToolContainer } from "./tool-container";

export type ThinkingToolPart = Extract<ChatMessage["parts"][number], { type: `tool-think` }>;

const ThinkingToolComponent: React.FC<{ toolCall: ThinkingToolPart; }> = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(true);

  // Extract thought - it might be partial during call/partial-call
  const thought = toolCall.input?.thought || "";

  // Track duration between start of streaming and completion
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const startTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    if (toolCall.state === "input-streaming") {
      if (startTimestampRef.current == null) {
        startTimestampRef.current = Date.now();
      }
    } else if (toolCall.state === "output-available") {
      if (startTimestampRef.current != null) {
        const elapsedMs = Date.now() - startTimestampRef.current;
        setDurationSeconds(Math.max(0, Math.round(elapsedMs / 1000)));
        startTimestampRef.current = null;
      }
    }
  }, [toolCall.state]);

  const thoughtMarkdown = useMemo(
    () => <Streamdown children={thought} className="size-full [&_p]:py-[2px] [&_p]:my-[2px]" />,
    [thought, toolCall.toolCallId],
  );

  return (
    <AnimatePresence mode="wait">
      {/* Streaming State (partial-call or call) */}
      {(toolCall.state === "input-streaming" || toolCall.state === "input-available") && (
        // Use ToolContainer but don't make it collapsible yet
        <ToolContainer key="tool-streaming" toolState={toolCall.state} blur={false}>
          {/* Header area with loading indicator */}
          <div className="mb-1 flex items-center">
            <PulsingDot className="ml-1 mr-2 flex-shrink-0" />
            <TextShimmer className="mr-2 font-medium">Thinking...</TextShimmer>
          </div>
          {/* Display streaming thought with markdown */}
          <div className="mt-1 ml-[7px] border-l border-gray-300 pl-3 text-[13px] text-gray-500 dark:text-gray-500">
            <Scroller className="max-h-[300px]" orientation="vertical" size={30} offset={20}>
              {thoughtMarkdown}
            </Scroller>
          </div>
        </ToolContainer>
      )}
      {/* Result State (collapsible) */}
      {toolCall.state === "output-available" && thought.trim().length > 0 && (
        <ToolContainer key="tool-result" toolState="output-available" blur={false}>
          {/* Collapsible Header bar */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div className="flex cursor-pointer items-center" onClick={() => setExpanded(!expanded)}>
            <motion.div animate={{ rotate: expanded ? 90 : 0 }} children={<ChevronRight size={14} />} />
            <span className="ml-1 font-medium">Thinking</span>
            <span className="ml-2 text-xs text-gray-500">
              {durationSeconds > 0 ? `Thought for ${durationSeconds} second${durationSeconds === 1 ? "" : "s"}` : ""}
            </span>
            {/* Display final thought truncated in header when collapsed - Optional */}
            {/* {!expanded && <span className={clsx("ml-2 text-xs truncate", darkMode ? "text-gray-400" : "text-gray-500")}>{thought}</span>} */}
          </div>
          {/* Collapsible Thought content */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                key="thinking-content-final"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto", transition: { duration: 0.15 } }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.1 } }}
                className="mt-1 ml-[7px] border-l border-gray-300 pl-3 text-[13px] text-gray-500 dark:border-gray-700 dark:text-gray-500"
              >
                <Scroller className="max-h-[300px]" orientation="vertical" size={30} offset={20}>
                  <Streamdown children={thought} className="size-full [&_p]:py-[2px] [&_p]:my-[2px]"/>
                </Scroller>
              </motion.div>
            )}
          </AnimatePresence>
        </ToolContainer>
      )}
      {toolCall.state === "output-available" && thought.trim().length === 0 && (
        <ToolContainer key="tool-result-empty" toolState="output-available" blur={false}>
          <span className="ml-1 font-medium">Thinking</span>
          <div className="flex items-center">
            <span className="ml-2 text-xs text-gray-500">
              {durationSeconds > 0 ? `Thought for ${durationSeconds} second${durationSeconds === 1 ? "" : "s"}` : ""}
            </span>
          </div>
        </ToolContainer>
      )}
    </AnimatePresence>
  );
};

// Memoize the component to prevent unnecessary re-renders
// Only re-render if the toolCall changes (comparing relevant properties)
export const ThinkingTool = memo(ThinkingToolComponent, (prevProps, nextProps) => {
  // Re-render if any of these change:
  // - state (streaming vs completed)
  // - thought content
  // - toolCallId
  return (
    prevProps.toolCall.state === nextProps.toolCall.state &&
    prevProps.toolCall.input?.thought === nextProps.toolCall.input?.thought &&
    prevProps.toolCall.toolCallId === nextProps.toolCall.toolCallId
  );
});

// Wrapper component to render a reasoning part using the ThinkingTool UI
type ReasoningPart = Extract<ChatMessage["parts"][number], { type: `reasoning` }>;

export const ReasoningAsThinkingTool = ({ part, id }: { part: ReasoningPart; id: string }) => (
  <ThinkingTool
    toolCall={
      part.state === "streaming"
        ? {
            type: "tool-think" as const,
            toolCallId: id,
            state: "input-streaming" as const,
            input: { thought: part.text },
          }
        : {
            type: "tool-think" as const,
            toolCallId: id,
            state: "output-available" as const,
            input: { thought: part.text },
            output: { success: true },
          }
    }
  />
);

export const ReasoningAsThinkingToolMemo = memo(ReasoningAsThinkingTool, (prevProps, nextProps) => {
  return prevProps.part.text === nextProps.part.text && prevProps.part.state === nextProps.part.state;
});

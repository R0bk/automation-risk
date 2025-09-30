import { AnimatePresence, motion } from "framer-motion";
import React from "react";

export interface StatusBarProps {
  isLoading: boolean;
  isStreaming?: boolean;
}
export const StatusBar: React.FC<StatusBarProps> = ({ isLoading, isStreaming = false }) => {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="pointer-events-none inline-flex"
          initial={{ opacity: 0, y: 6, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.95 }}
          transition={{
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1], // Cubic bezier for smooth easing
          }}
        >
          <motion.div
            className="mx-auto overflow-hidden rounded-full shadow-[0_10px_24px_rgba(38,37,30,0.18)]"
            animate={{
              width: isStreaming ? 220 : 96,
              height: 6,
              backgroundColor: isStreaming
                ? "rgba(207, 45, 86, 0.2)"
                : "rgba(38, 37, 30, 0.92)",
              scale: !isStreaming ? [0.94, 1, 0.94] : 1,
              opacity: !isStreaming ? [0.55, 1, 0.55] : 1,
            }}
            transition={{
              width: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
              backgroundColor: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
              scale: { duration: 1.6, ease: "easeInOut", repeat: !isStreaming ? Infinity : 0 },
              opacity: { duration: 1.6, ease: "easeInOut", repeat: !isStreaming ? Infinity : 0 },
            }}
          >
            {!isStreaming ? (
              // Phase 1: Pulsing animation
              <motion.div
                className="h-full w-full"
                style={{
                  background: "linear-gradient(90deg, #cf2d56 0%, #f54e00 100%)",
                }}
                animate={{ opacity: [0.45, 1, 0.45] }}
                transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
              />
            ) : (
              // Phase 2: Moving bar (during streaming)
              <motion.div
                className="h-full"
                initial={{ x: "-150%" }}
                animate={{
                  x: ["-150%", "250%"],
                }}
                transition={{
                  x: {
                    duration: 2.5,
                    ease: "linear",
                    repeat: Infinity,
                    repeatDelay: 0.5,
                  },
                }}
                style={{
                  background: "linear-gradient(90deg, rgba(207,45,86,0.25) 0%, rgba(245,78,0,0.8) 100%)",
                  width: "40%",
                  borderRadius: "999px",
                  boxShadow: "0 0 12px rgba(245, 78, 0, 0.35)",
                }}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

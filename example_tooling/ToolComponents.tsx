import { clsx } from "clsx";
import { motion } from "framer-motion";

const ToolContainer = ({
  toolState,
  children,
  className,
  blur = true,
}: {
  toolState: "input-streaming" | "input-available" | "output-available" | "output-error";
  children: React.ReactNode;
  className?: string;
  blur?: boolean;
}) => {
  return (
    <motion.div
      key={toolState}
      initial={{ opacity: 0, ...(blur ? { filter: "blur(4px)" } : {}) }}
      animate={{ opacity: 1, height: "auto", ...(blur ? { filter: "blur(0px)" } : {}), transition: { duration: 0.4 } }}
      exit={{ opacity: 0, ...(blur ? { filter: "blur(4px)" } : {}), transition: { duration: 0.4 } }}
      className={clsx(
        "text-ak-body-xxs w-full max-w-[860px] overflow-hidden rounded-md bg-gray-50/20 p-2 text-gray-800 dark:bg-neutral-900 dark:text-neutral-200",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export { ToolContainer };

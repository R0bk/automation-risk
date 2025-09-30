"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import type { TaskMixView } from "@/lib/run/task-mix";

interface TaskMixViewContextValue {
  view: TaskMixView;
  setView: (view: TaskMixView) => void;
}

const TaskMixViewContext = createContext<TaskMixViewContextValue | undefined>(undefined);

export function TaskMixViewProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<TaskMixView>("coverage");

  const value = useMemo(() => ({ view, setView }), [view]);

  return <TaskMixViewContext.Provider value={value}>{children}</TaskMixViewContext.Provider>;
}

export function useTaskMixView(): TaskMixViewContextValue {
  const context = useContext(TaskMixViewContext);
  if (!context) {
    throw new Error("useTaskMixView must be used within a TaskMixViewProvider");
  }
  return context;
}

export type TaskMixCategory = "automation" | "augmentation" | "manual";

export const TASK_MIX_COLORS: Record<TaskMixCategory, string> = {
  automation: "#FD5108",
  augmentation: "#FFAA72",
  manual: "#D1D5DB",
};

export interface TaskMixCounts {
  automation: number;
  augmentation: number;
  manual: number;
}

export interface TaskMixShares {
  automation: number | null;
  augmentation: number | null;
  manual: number | null;
}

export const TASK_MIX_LABELS: Record<TaskMixCategory, string> = {
  automation: "Automation tasks",
  augmentation: "Augmentation tasks",
  manual: "Manual tasks",
};

export const getTaskMixTotal = (counts: TaskMixCounts) =>
  counts.automation + counts.augmentation + counts.manual;

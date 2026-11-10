import type { Task } from "./types";
import { tehranReferenceTime } from "./referenceTime";

/** A manually entered remaining work budget, captured at a particular instant. */
export type ManualBudgetEntry = { day: string; minutes: number; recordedAt: string };

/** Completed tasks consume the entered budget once, and reopening restores it. */
export function remainingManualBudget(entry: ManualBudgetEntry, tasks: Task[]): number {
  const recorded = Date.parse(entry.recordedAt);
  if (!Number.isFinite(recorded)) return Math.max(0, entry.minutes);
  const consumed = tasks.reduce((sum, task) => {
    if(task.stages?.length){return sum+task.stages.reduce((stageSum,stage)=>{
      if(!stage.completed||!stage.completedAt)return stageSum;
      const completed=Date.parse(stage.completedAt);
      if(!Number.isFinite(completed)||completed<recorded)return stageSum;
      const day=stage.completedDay??tehranReferenceTime(new Date(completed)).day;
      return day===entry.day?stageSum+stage.duration:stageSum;
    },0)}
    if (!task.completed) return sum;
    const completed = task.completedAt ? Date.parse(task.completedAt) : NaN;
    if (!Number.isFinite(completed) || completed < recorded) return sum;
    const day = task.completedDay ?? tehranReferenceTime(new Date(completed)).day;
    return day === entry.day ? sum + task.duration : sum;
  }, 0);
  return Math.max(0, entry.minutes - consumed);
}

/** Preserve old numeric budgets until the user explicitly edits them. */
export function migrateManualBudget(day: string, minutes: number): ManualBudgetEntry {
  return { day, minutes: Math.max(0, minutes), recordedAt: "" };
}

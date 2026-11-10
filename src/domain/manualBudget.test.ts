import { describe, expect, it } from "vitest";
import { migrateManualBudget, remainingManualBudget } from "./manualBudget";
import type { Task } from "./types";

const base: Task = { id: "1", title: "Task", duration: 90, estimateSource: "manual", deadlineKind: "none", completed: true, completedAt: "2026-11-11T12:00:00Z", createdAt: "" };
const budget = { day: "2026-11-11", minutes: 180, recordedAt: "2026-11-11T10:00:00Z" };

describe("remaining manual budget", () => {
  it("deducts a completion once and restores it on reopen", () => {
    expect(remainingManualBudget(budget, [base])).toBe(90);
    expect(remainingManualBudget(budget, [{ ...base, completed: false }])).toBe(180);
  });
  it("does not deduct completions before the budget was entered", () => {
    expect(remainingManualBudget(budget, [{ ...base, completedAt: "2026-11-11T09:00:00Z" }])).toBe(180);
  });
  it("retains legacy budgets without inventing a timestamp", () => {
    expect(remainingManualBudget(migrateManualBudget("2026-11-11", 180), [base])).toBe(180);
  });
});

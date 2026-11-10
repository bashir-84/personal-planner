import { describe, expect, it } from "vitest";
import { prepareImport, mergeImport } from "./taskImport";
import { emptyState } from "../storage/local";

const payload = (tasks: unknown[], projects: unknown[] = []) =>
  JSON.stringify({ format: "personal-planner-tasks", schema_version: "1.0.0", projects, tasks });

describe("AI task import", () => {
  it("accepts a title-only task and keeps unspecified values absent", () => {
    const p = prepareImport(payload([{ title: "Send the draft" }]), emptyState);
    expect(p.errors).toEqual([]);
    expect(p.validCount).toBe(1);
    const task = p.rows[0].task!;
    expect(task.title).toBe("Send the draft");
    expect(task.duration).toBe(30);
    expect(task.estimateSource).toBe("default");
    expect(task.importance).toBeUndefined();
    expect(task.urgency).toBeUndefined();
    expect(task.deadline).toBeUndefined();
    expect(task.projectId).toBeUndefined();
    const merged = mergeImport(p, emptyState);
    expect(merged.tasks).toHaveLength(1);
  });

  it("maps a supplied project and only explicitly given priority", () => {
    const p = prepareImport(payload([
      { id: "t1", title: "Prepare slides", project_id: "p1",
        priority: { importance: 5, urgency: null }, estimated_minutes: 75 }
    ], [{ id: "p1", name: "Education" }]), emptyState);
    expect(p.errors).toEqual([]);
    const merged = mergeImport(p, emptyState);
    expect(merged.projects).toHaveLength(1);
    expect(merged.tasks[0].projectId).toBe(merged.projects[0].id);
    expect(merged.tasks[0].importance).toBe(5);
    expect(merged.tasks[0].urgency).toBeUndefined();
    expect(merged.tasks[0].duration).toBe(75);
  });

  it("skips a repeated import instead of duplicating the task", () => {
    const json = payload([{ id: "j-1", title: "Call team", source: { app: "ai-journal" } }]);
    const first = mergeImport(prepareImport(json, emptyState), emptyState);
    const secondPreview = prepareImport(json, first);
    expect(secondPreview.duplicateCount).toBe(1);
    expect(secondPreview.validCount).toBe(0);
  });

  it("rejects invalid referenced projects and prevents partial writes", () => {
    const p = prepareImport(payload([
      { title: "Valid task" }, { title: "Project task", project_id: "missing" }
    ]), emptyState);
    expect(p.errors.length).toBeGreaterThan(0);
    expect(() => mergeImport(p, emptyState)).toThrow();
  });

  it("preserves recurrence and source details without pretending to schedule them", () => {
    const recurrence = { frequency: "daily", interval: 1, start_date: null };
    const p = prepareImport(payload([{ title: "Read", recurrence, notes: "Journal quote" }]), emptyState);
    expect(p.rows[0].warnings.join(" ")).toMatch(/Recurrence/);
    const stored = mergeImport(p, emptyState).tasks[0] as typeof p.rows[0]["task"] & {
      importMetadata?: { raw: Record<string, unknown> };
    };
    expect(stored?.importMetadata?.raw.recurrence).toEqual(recurrence);
    expect(stored?.importMetadata?.raw.notes).toBe("Journal quote");
  });
});

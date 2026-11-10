import { describe, expect, it } from "vitest";
import { capacityForDay, capacityForReferenceDay, makeDraft, validate } from "./engine";
import type { Task } from "./types";

const day = "2026-11-11";
const task: Task = { id: "task", title: "Task", duration: 60, estimateSource: "manual", deadlineKind: "hard", deadline: "2026-11-11T08:30:00Z", completed: false, createdAt: "" };
describe("remaining capacity and hourly deadlines", () => {
  it("accepts a task that finishes at or before its deadline", () => {
    expect(validate([{ taskId: task.id, day }], [task], [], {}, { day, minute: 9 * 60 }).filter(c => c.type === "deadline")).toHaveLength(0);
    expect(validate([{ taskId: task.id, day }], [{ ...task, deadline: "2026-11-11T06:30:00Z" }], [], {}, { day, minute: 9 * 60 }).filter(c => c.type === "deadline")).toHaveLength(0);
  });
  it("flags a task that cannot finish before its deadline", () => {
    expect(validate([{ taskId: task.id, day }], [{ ...task, deadline: "2026-11-11T05:30:00Z" }], [], {}, { day, minute: 9 * 60 }).some(c => c.type === "deadline")).toBe(true);
  });
  it("calculates the remaining default capacity at 18:00 with an hour of appointments", () => {
    expect(capacityForDay([{ id: "a", title: "", day, start: 19 * 60, end: 20 * 60, blocking: true }], day, undefined, 18 * 60).effectiveCapacity).toBe(200);
  });
  it("gives past days no remaining opportunity when a reference is supplied", () => {
    expect(validate([{ taskId: task.id, day }], [task], [], {}, { day: "2026-11-12", minute: 600 }).some(c => c.type === "capacity")).toBe(true);
  });
  it("clips an ongoing appointment and merges overlapping appointments", () => {
    const appointments = [
      { id: "a", title: "", day, start: 17*60, end: 19*60, blocking: true },
      { id: "b", title: "", day, start: 18*60+30, end: 20*60, blocking: true }
    ];
    expect(capacityForReferenceDay(appointments, day, { day, minute: 18*60 })).toMatchObject({ freeMinutes: 240, effectiveCapacity: 160 });
  });
  it("caps a manual budget by the physical time remaining", () => {
    expect(capacityForReferenceDay([], day, { day, minute: 23*60 }, 180).effectiveCapacity).toBe(60);
  });
  it("checks remaining time when generating a proposal", () => {
    const openTask = { ...task, deadline: undefined, deadlineKind: "none" as const, duration: 120 };
    const draft = makeDraft([openTask], [day, "2026-11-12"], [], {}, 0, undefined, { day, minute: 23*60 });
    expect(draft.items[0].day).toBe("2026-11-12");
  });
});

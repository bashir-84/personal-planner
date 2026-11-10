import type { PlannerState, Task, PlanItem, Project } from "./types";
import { validate } from "./engine";

/**
 * AI journal -> Personal Planner import adapter.
 * Contract: personal-planner-tasks v1.0.0.
 * Nothing is written during preview. Unknown fields are preserved in importMetadata.raw.
 */
type RecordValue = Record<string, unknown>;
type StoredImport = {
  sourceKey: string;
  schemaVersion: string;
  originalEstimatedMinutes: number | null;
  importedAt: string;
  raw: RecordValue;
};
type StoredTask = Task & { importMetadata?: StoredImport };
export type ImportRow = {
  index: number;
  title: string;
  sourceKey: string;
  status: "ready" | "duplicate" | "invalid";
  errors: string[];
  warnings: string[];
  task?: Task;
  confirmed?: PlanItem;
  projectRef?: string;
};
export type ImportPreview = {
  rows: ImportRow[];
  errors: string[];
  warnings: string[];
  projects: Project[];
  validCount: number;
  duplicateCount: number;
};

const object = (x: unknown): x is RecordValue =>
  x !== null && typeof x === "object" && !Array.isArray(x);
const str = (x: unknown): string | undefined =>
  typeof x === "string" && x.trim() ? x.trim() : undefined;
const int = (x: unknown): number | undefined =>
  typeof x === "number" && Number.isSafeInteger(x) ? x : undefined;
const optionalObject = (x: unknown): RecordValue =>
  object(x) ? x : {};
const timestamp = (x: unknown) =>
  typeof x === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(x) && !Number.isNaN(Date.parse(x));
const tehranDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const tehranMinute = (iso: string) => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  return Number(p.find(x => x.type === "hour")?.value ?? 0) * 60 + Number(p.find(x => x.type === "minute")?.value ?? 0);
};
const fingerprint = (s: string) => {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
};
const norm = (s: string) => s.trim().toLocaleLowerCase("fa-IR");
const acceptableColor = (x: unknown) =>
  typeof x === "string" && /^#[0-9a-fA-F]{6}$/.test(x) ? x : "#8A968F";

/** Converts pasted AI JSON or a downloaded JSON file to a safe preview. */
export function prepareImport(input: string, current: PlannerState): ImportPreview {
  const result: ImportPreview = { rows: [], projects: [], errors: [], warnings: [], validCount: 0, duplicateCount: 0 };
  let data: unknown;
  try {
    const cleaned = input.trim().replace(/^`{3}(?:json)?\s*/i, "").replace(/\s*`{3}$/, "");
    data = JSON.parse(cleaned);
  } catch {
    result.errors.push("Invalid JSON. Paste the complete JSON output, not the journal text.");
    return result;
  }
  if (!object(data) || data.format !== "personal-planner-tasks" || data.schema_version !== "1.0.0") {
    result.errors.push("Expected format personal-planner-tasks with schema_version 1.0.0.");
    return result;
  }
  if (!Array.isArray(data.tasks)) {
    result.errors.push("tasks must be an array (it can be empty).");
    return result;
  }
  const declared = data.projects === undefined || data.projects === null ? [] : data.projects;
  if (!Array.isArray(declared)) {
    result.errors.push("projects must be an array when provided.");
    return result;
  }
  const projectMap = new Map<string, string>();
  const usedProjectNames = new Map(current.projects.map(p => [norm(p.name), p.id]));
  const usedProjectIds = new Set(current.projects.map(p => p.id));
  declared.forEach((raw, i) => {
    if (!object(raw) || !str(raw.name)) {
      result.errors.push("projects[" + i + "] needs a nonempty name.");
      return;
    }
    const name = str(raw.name)!;
    const externalId = str(raw.id) ?? "project-" + fingerprint(name);
    if (projectMap.has(externalId)) {
      result.errors.push("Duplicate project id: " + externalId);
      return;
    }
    const match = usedProjectNames.get(norm(name)) ?? (usedProjectIds.has(externalId) ? externalId : undefined);
    const localId = match ?? crypto.randomUUID();
    projectMap.set(externalId, localId);
    if (!match) {
      const project: Project = { id: localId, name, color: acceptableColor(raw.color) };
      result.projects.push(project);
      usedProjectNames.set(norm(name), localId);
      usedProjectIds.add(localId);
    }
  });
  const existing = new Set((current.tasks as StoredTask[])
    .map(t => t.importMetadata?.sourceKey).filter((x): x is string => Boolean(x)));
  const sourceKeys = new Set<string>();
  (data.tasks as unknown[]).forEach((raw, index) => {
    const row: ImportRow = {
      index: index + 1, title: "", sourceKey: "", status: "ready", errors: [], warnings: []
    };
    result.rows.push(row);
    if (!object(raw)) {
      row.errors.push("Task must be an object.");
      row.status = "invalid";
      return;
    }
    row.title = str(raw.title) ?? "";
    if (!row.title) row.errors.push("title is required.");
    const source = optionalObject(raw.source);
    const origin = str(source.app) ?? "ai-import";
    const identifier = str(source.original_id) ?? str(raw.id) ?? "row-" + (index + 1) + "-" + fingerprint(JSON.stringify(raw));
    row.sourceKey = origin + ":" + identifier;
    if (sourceKeys.has(row.sourceKey)) row.errors.push("Duplicate task source ID in this file.");
    sourceKeys.add(row.sourceKey);
    if (existing.has(row.sourceKey) || (str(raw.id) && current.tasks.some(t => t.id === raw.id))) {
      row.status = "duplicate";
      row.warnings.push("Already imported; will not create another copy.");
      result.duplicateCount++;
      return;
    }
    const priority = optionalObject(raw.priority);
    const flexibility = optionalObject(raw.flexibility);
    const checkInteger = (value: unknown, field: string, min: number, max = Number.MAX_SAFE_INTEGER) => {
      if (value === null || value === undefined) return undefined;
      const number = int(value);
      if (number === undefined || number < min || number > max) row.errors.push(field + " must be an integer from " + min + " to " + max + ".");
      return number !== undefined && number >= min && number <= max ? number : undefined;
    };
    const importance = checkInteger(priority.importance, "priority.importance", 1, 5);
    const urgency = checkInteger(priority.urgency, "priority.urgency", 1, 5);
    const estimate = checkInteger(raw.estimated_minutes, "estimated_minutes", 1);
    const remaining = checkInteger(raw.remaining_minutes, "remaining_minutes", 0);
    checkInteger(flexibility.level, "flexibility.level", 1, 5);
    checkInteger(flexibility.minimum_session_minutes, "flexibility.minimum_session_minutes", 1);
    if (flexibility.splittable != null && typeof flexibility.splittable !== "boolean")
      row.errors.push("flexibility.splittable must be a boolean or null.");
    const status = str(raw.status) ?? "open";
    if (!["open", "planned", "confirmed", "completed", "done"].includes(status))
      row.errors.push("Unsupported status: " + status);
    for (const field of ["deadline_at", "earliest_start_at", "completed_at"] as const)
      if (raw[field] != null && !timestamp(raw[field])) row.errors.push(field + " needs an ISO datetime.");
    const projectRef = str(raw.project_id);
    if (projectRef) {
      const mapped = projectMap.get(projectRef) ?? (current.projects.some(p => p.id === projectRef) ? projectRef : undefined);
      if (!mapped) row.errors.push("Unknown project_id: " + projectRef);
      else row.projectRef = mapped;
    }
    const originalSessions = raw.planned_sessions == null ? [] : raw.planned_sessions;
    if (!Array.isArray(originalSessions)) row.errors.push("planned_sessions must be an array.");
    else {
      const confirmed = originalSessions.filter(s => object(s) && s.state === "confirmed");
      if (confirmed.length > 1) row.warnings.push("Multiple confirmed sessions are preserved but not automatically scheduled.");
      if (confirmed.length === 1) {
        const session = confirmed[0] as RecordValue;
        if (!timestamp(session.start_at) || !timestamp(session.end_at)) {
          row.errors.push("Confirmed session requires start_at and end_at ISO datetimes.");
        } else {
          const start = session.start_at as string, end = session.end_at as string;
          const day = tehranDay(start);
          if (Date.parse(end) <= Date.parse(start) || tehranDay(end) !== day) {
            row.warnings.push("Cross-day or invalid confirmed session preserved for manual review.");
          } else {
            row.confirmed = { taskId: "", day, start: tehranMinute(start), end: tehranMinute(end) };
            row.warnings.push("Confirmed day and time imported; the current planning engine does not enforce an exact time slot.");
          }
        }
      }
    }
    if (raw.recurrence != null) row.warnings.push("Recurrence preserved in metadata; automatic recurring instances are not supported yet.");
    if (Array.isArray(raw.depends_on) && raw.depends_on.length) row.warnings.push("Dependencies preserved in metadata; enforcement is not supported yet.");
    const planned = raw.planned_sessions;
    if (planned && Array.isArray(planned) && planned.some(x => object(x) && x.state !== "confirmed"))
      row.warnings.push("Non-confirmed proposed sessions are preserved for manual scheduling.");
    if (!estimate && remaining === undefined) row.warnings.push("Duration unknown: planner uses its explicit, editable 30-minute provisional default.");
    if (estimate !== undefined && remaining !== undefined && remaining !== estimate)
      row.warnings.push("Planner duration uses remaining_minutes; original estimate is preserved.");
    const kind = str(raw.deadline_kind);
    if (kind && !["hard", "flexible", "none"].includes(kind)) row.errors.push("deadline_kind must be hard, flexible, or none.");
    if (raw.deadline_at && !kind) row.warnings.push("Deadline kind unspecified: imported as flexible, not assumed hard.");
    if (row.errors.length) { row.status = "invalid"; return; }
    const now = new Date().toISOString();
    const duration = remaining !== undefined && remaining > 0 ? remaining : (estimate ?? 30);
    const imported: Task = {
      id: crypto.randomUUID(), title: row.title, duration,
      estimateSource: estimate === undefined && remaining === undefined ? "default" : "manual",
      ...(row.projectRef ? { projectId: row.projectRef } : {}),
      ...(importance === undefined ? {} : { importance }),
      ...(urgency === undefined ? {} : { urgency }),
      ...(raw.deadline_at ? { deadline: String(raw.deadline_at) } : {}),
      deadlineKind: raw.deadline_at ? (kind === "hard" ? "hard" : "flexible") : "none",
      completed: status === "completed" || status === "done",
      ...(timestamp(raw.completed_at) ? { completedAt: String(raw.completed_at), completedDay: tehranDay(String(raw.completed_at)) } : {}),
      ...(row.confirmed ? { plannedDay: row.confirmed.day } : {}),
      createdAt: now
    };
    Object.assign(imported, { importMetadata: {
      sourceKey: row.sourceKey, schemaVersion: "1.0.0",
      originalEstimatedMinutes: estimate ?? null,
      importedAt: now, raw
    } satisfies StoredImport });
    row.task = imported;
    if (row.confirmed) row.confirmed.taskId = imported.id;
    result.validCount++;
  });
  // Preview the impact of imported confirmed entries before any write occurs.
  const pending = result.rows.filter(r => r.status === "ready" && r.task);
  const upcoming = pending.flatMap(r => r.confirmed ? [r.confirmed] : []);
  if (upcoming.length) {
    const planned = [...current.confirmed, ...upcoming];
    const tasks = [...current.tasks, ...pending.map(r => r.task!)];
    const issues = validate(planned, tasks, current.appointments, current.manualBudgets);
    const newTaskIds = new Set(pending.map(r => r.task!.id));
    const days = new Set(upcoming.map(i => i.day));
    const affected = issues.filter(c => c.taskId ? newTaskIds.has(c.taskId) : Boolean(c.day && days.has(c.day)));
    for (const issue of affected) {
      for (const row of pending) {
        if (row.confirmed && (issue.taskId === row.task?.id || (!issue.taskId && issue.day === row.confirmed.day))) {
          row.warnings.push("Scheduling conflict (" + issue.type + "): " + issue.message);
        }
      }
    }
  }
  if (result.rows.some(r => r.errors.length)) result.errors.push("Fix invalid rows before importing; no partial writes will occur.");
  return result;
}

/** Pure, atomic merge: caller must save only after checking preview.errors. */
export function mergeImport(preview: ImportPreview, current: PlannerState): PlannerState {
  if (preview.errors.length) throw new Error(preview.errors.join(" "));
  const accepted = preview.rows.filter(r => r.status === "ready" && r.task);
  if (!accepted.length) throw new Error("No new tasks to import.");
  const referenced = new Set(accepted.map(r => r.projectRef).filter(Boolean));
  const newProjects = preview.projects.filter(p => referenced.has(p.id));
  const newTasks = accepted.map(r => r.task!);
  const newConfirmed = accepted.flatMap(r => r.confirmed ? [r.confirmed] : []);
  const merged = {
    ...current, revision: current.revision + 1,
    projects: [...current.projects, ...newProjects],
    tasks: [...current.tasks, ...newTasks],
    confirmed: [...current.confirmed, ...newConfirmed]
  };
  const conflicts = validate(merged.confirmed, merged.tasks, merged.appointments, merged.manualBudgets);
  if (conflicts.length) {
    const importedIds = new Set(newTasks.map(t => t.id));
    const extra = conflicts.filter(c => c.taskId ? importedIds.has(c.taskId) : newConfirmed.some(i => i.day === c.day));
    if (extra.length) {
      const warning = "Imported plan has " + extra.length + " scheduling conflict(s). Review the confirmed plan.";
      for (const row of accepted) if (row.confirmed) row.warnings.push(warning);
    }
  }
  return merged;
}

"use client";

import { useEffect, useState } from "react";
import type { PlannerState, Task } from "@/domain/types";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

const jalaliFormatter = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  calendar: "persian", year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC"
});
const jalaliDisplay = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  calendar: "persian", year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tehran"
});
const tehranParts = (timestamp: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit"
}).formatToParts(new Date(timestamp));
const persianDateValue = (timestamp?: string) => {
  if (!timestamp) return "";
  const parts = jalaliDisplay.formatToParts(new Date(timestamp));
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}/${value("month")}/${value("day")}`;
};
const localClock = (timestamp?: string) => timestamp
  ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(timestamp))
  : "12:00";
const persianToGregorian = (input: string) => {
  const normalized = input.replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  const match = normalized.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return undefined;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  // Search the Gregorian year corresponding to this Jalali year. Intl supplies
  // the calendar conversion, avoiding a second hand-maintained calendar table.
  const start = Date.UTC(year + 621, 2, 15, 12);
  for (let offset = 0; offset < 380; offset++) {
    const date = new Date(start + offset * 86400000);
    const parts = jalaliFormatter.formatToParts(date);
    const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
    if (get("year") === year && get("month") === month && get("day") === day) {
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    }
  }
  return undefined;
};
const dateWithTime = (day: string, time: string) => {
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  // Tehran is UTC+03:30; storing an ISO timestamp keeps the planner's existing format.
  return new Date(Date.UTC(year, month - 1, date, hour - 3, minute - 30)).toISOString();
};

export function TaskEditDialog({ task, projects, onChange, onToggle, onDelete, onClose }: {
  task: Task;
  projects: PlannerState["projects"];
  onChange: (patch: Partial<Task>) => void;
  onToggle: (completed: boolean) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [draft, setDraft] = useState(task);
  const [pendingCompleted, setPendingCompleted] = useState<boolean | undefined>();
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const save = () => {
    onChange({ ...draft });
    if (pendingCompleted !== undefined) onToggle(pendingCompleted);
    onClose();
  };
  return <Modal label="Edit task" onClose={onClose}>
    <section className="draft taskDialog">
      <div className="draftHead"><div><span className="eyebrow">Task</span><h2>Edit task</h2></div>
        <button className="iconButton" aria-label="Close" title="Close" onClick={onClose}><Icon name="close" /></button>
      </div>
      <TaskEditor task={isMobile ? draft : task} projects={projects}
        onChange={patch => isMobile ? setDraft(value => ({ ...value, ...patch })) : onChange(patch)}
        onToggle={completed => isMobile ? setPendingCompleted(completed) : onToggle(completed)}
        onDelete={onDelete} showHint={!isMobile} />
      {isMobile && <div className="taskDialogConfirm"><button className="primary" onClick={save}>Confirm</button></div>}
    </section>
  </Modal>;
}

export function TaskComposerDialog({ task, projects, onChange, onConfirm, onClose }: {
  task: Task;
  projects: PlannerState["projects"];
  onChange: (patch: Partial<Task>) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return <Modal label="New task" onClose={onClose}>
    <section className="draft taskDialog">
      <div className="draftHead"><div><span className="eyebrow">Task</span><h2>New task</h2></div>
        <button className="iconButton" aria-label="Close" title="Close" onClick={onClose}><Icon name="close" /></button>
      </div>
      <TaskEditor task={task} projects={projects} onChange={onChange} onToggle={() => undefined} showActions={false} showHint={false} />
      <div className="taskDialogConfirm"><button className="primary" disabled={!task.title.trim()} onClick={onConfirm}>Confirm</button></div>
    </section>
  </Modal>;
}

export function TaskEditor({ task, projects, onChange, onToggle, onDelete, showActions = true, showHint = true }: {
  task: Task;
  projects: PlannerState["projects"];
  onChange: (patch: Partial<Task>) => void;
  onToggle: (completed: boolean) => void;
  onDelete?: () => void;
  showActions?: boolean;
  showHint?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [jalaliDate, setJalaliDate] = useState(persianDateValue(task.deadline));
  useEffect(() => setJalaliDate(persianDateValue(task.deadline)), [task.id, task.deadline]);
  const project = projects.find(item => item.id === task.projectId);
  const durationHours = Math.floor(task.duration / 60);
  const durationMinutes = task.duration % 60;
  const timeValue = localClock(task.deadline);
  const setDuration = (hours: number, minutes: number) => onChange({ duration: Math.max(1, hours * 60 + minutes), estimateSource: "manual" });
  const setDeadlineDate = (value: string) => {
    if (!value) { onChange({ deadline: undefined }); return; }
    const gregorian = persianToGregorian(value);
    if (gregorian) onChange({ deadline: dateWithTime(gregorian, timeValue) });
  };
  const setDeadlineTime = (value: string) => {
    if (task.deadline) {
      const parts = tehranParts(task.deadline);
      const day = `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}-${parts.find(part => part.type === "day")?.value}`;
      onChange({ deadline: dateWithTime(day, value) });
    }
  };

  return <div className="editorGrid taskEditorGrid">
    {showHint && <p className="editorHint">Changes save automatically.</p>}
    {(task.completionRecords?.length || task.completionHistory?.length || task.completedAt) && <div className="completionHistory"><b>Completion history</b><ul>
      {task.completionRecords?.length ? task.completionRecords.map((record, index) => <li key={`${record.completedAt}-${index}`}>{new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "numeric", timeZone: "Asia/Tehran" }).format(new Date(`${record.day}T12:00:00Z`))} · {new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(record.completedAt))}</li>) : (task.completionHistory?.length ? task.completionHistory : [task.completedAt!]).map((date, index) => <li key={`${date}-${index}`}>{new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(date))}</li>)}
    </ul></div>}
    <label className="taskTitleField">Title<input value={task.title} onChange={event => onChange({ title: event.target.value })} /></label>
    <label className="taskProjectField">Project<div className="projectSelectWrap">
      <span className="projectColorSwatch" style={{ background: project?.color ?? "transparent" }} aria-label={project ? `${project.name} color` : "No project color"} />
      <select value={task.projectId ?? ""} onChange={event => onChange({ projectId: event.target.value || undefined })}>
        <option value="">No project</option>{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </div></label>
    <fieldset className="taskDurationField"><legend>Duration</legend><div className="durationInputs">
      <label><input type="number" min="0" value={durationHours} aria-label="Duration hours" onChange={event => setDuration(Number(event.target.value) || 0, durationMinutes)} /><span>h</span></label>
      <label><input type="number" min="0" max="59" value={durationMinutes} aria-label="Duration minutes" onChange={event => setDuration(durationHours, Math.min(59, Number(event.target.value) || 0))} /><span>min</span></label>
    </div></fieldset>
    <fieldset className="deadlineTypeField"><legend>Deadline type</legend><div className="deadlineTypeOptions" role="radiogroup" aria-label="Deadline type">
      {([ ["none", "None"], ["hard", "Hard"], ["flexible", "Flexible"] ] as const).map(([value, label]) => <label key={value} className={task.deadlineKind === value ? "selected" : ""}>
        <input type="radio" name={`deadline-${task.id}`} checked={task.deadlineKind === value} onChange={() => onChange({ deadlineKind: value })} />{label}
      </label>)}
    </div></fieldset>
    <fieldset className="taskDeadlineField"><legend>Deadline · شمسی</legend><div className="deadlineInputs">
      <label><span className="srOnly">Persian date, year/month/day</span><input dir="ltr" inputMode="numeric" placeholder="۱۴۰۵/۰۸/۱۹" aria-label="Deadline Persian date" value={jalaliDate} onChange={event => { setJalaliDate(event.target.value); setDeadlineDate(event.target.value); }} /></label>
      <label><span className="srOnly">Time</span><input dir="ltr" type="time" aria-label="Deadline time" value={task.deadline ? timeValue : "12:00"} disabled={!task.deadline} onChange={event => setDeadlineTime(event.target.value)} /></label>
    </div></fieldset>
    <RatingField label="Importance" value={task.importance} onChange={value => onChange({ importance: value })} />
    <RatingField label="Urgency" value={task.urgency} onChange={value => onChange({ urgency: value })} />
    {showActions && <div className="taskEditorActions">
      <button className="dangerButton" onClick={() => onToggle(!task.completed)}><Icon name={task.completed ? "check" : "check"} />{task.completed ? "Reopen task" : "Move to completed"}</button>
      {onDelete && <button className={`taskDeleteButton ${confirmDelete ? "isConfirming" : ""}`} onClick={() => {
        if (!confirmDelete) setConfirmDelete(true);
        else onDelete();
      }} aria-label={confirmDelete ? "Confirm delete task" : "Delete task"} title={confirmDelete ? "Tap again to confirm deletion" : "Delete task"}>
        <Icon name="trash" /><span>{confirmDelete ? "Confirm delete?" : "Delete"}</span>
      </button>}
    </div>}
  </div>;
}

function RatingField({ label, value, onChange }: { label: string; value?: number; onChange: (value: number | undefined) => void }) {
  return <fieldset className="ratingField"><legend>{label}</legend><div className="ratingScale" role="radiogroup" aria-label={label}>
    {[1, 2, 3, 4, 5].map(level => <label key={level} className={value === level ? "selected" : ""}>
      <input type="radio" name={`rating-${label}`} value={level} checked={value === level} onChange={() => onChange(level)} aria-label={`${label} ${level}`} />
      <span>{level}</span>
    </label>)}
  </div></fieldset>;
}

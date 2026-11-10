"use client";

import { useEffect, useState } from "react";
import type { PlannerState, Task } from "@/domain/types";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import {dayOffset,deadlineDayOffset} from "@/domain/calendarDays";
import {tehranReferenceTime} from "@/domain/referenceTime";

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

export function TaskEditDialog({ task, projects, onChange, onToggle, onDelete, onSkip, onClose, referenceDay, referenceInstant }: {
  task: Task;
  projects: PlannerState["projects"];
  onChange: (patch: Partial<Task>) => void;
  onToggle: (completed: boolean) => void;
  onDelete?: () => void;
  onSkip?: () => void;
  onClose: () => void;
  referenceDay?: string;
  referenceInstant?: string;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [valid,setValid]=useState(true);
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
      <TaskEditor task={isMobile ? draft : task} projects={projects} referenceDay={referenceDay} referenceInstant={referenceInstant} onValidityChange={setValid}
        onChange={patch => isMobile ? setDraft(value => ({ ...value, ...patch })) : onChange(patch)}
        onToggle={completed => isMobile ? setPendingCompleted(completed) : onToggle(completed)}
        onDelete={onDelete} onSkip={onSkip} showHint={!isMobile} />
      {isMobile && <div className="taskDialogConfirm"><button className="primary" disabled={!valid} onClick={save}>Confirm</button></div>}
    </section>
  </Modal>;
}

export function TaskComposerDialog({ task, projects, onChange, onConfirm, onClose, referenceDay, referenceInstant }: {
  task: Task;
  projects: PlannerState["projects"];
  onChange: (patch: Partial<Task>) => void;
  onConfirm: () => void;
  onClose: () => void;
  referenceDay?: string;
  referenceInstant?: string;
}) {
  const [valid,setValid]=useState(true);
  return <Modal label="New task" onClose={onClose}>
    <section className="draft taskDialog">
      <div className="draftHead"><div><span className="eyebrow">Task</span><h2>New task</h2></div>
        <button className="iconButton" aria-label="Close" title="Close" onClick={onClose}><Icon name="close" /></button>
      </div>
      <TaskEditor task={task} projects={projects} referenceDay={referenceDay} referenceInstant={referenceInstant} onValidityChange={setValid} onChange={onChange} onToggle={() => undefined} showActions={false} showHint={false} />
      <div className="taskDialogConfirm"><button className="primary" disabled={!task.title.trim()||!valid} onClick={onConfirm}>Confirm</button></div>
    </section>
  </Modal>;
}

export function TaskEditor({ task, projects, onChange, onToggle, onDelete, onSkip, showActions = true, showHint = true, referenceDay, referenceInstant, onValidityChange }: {
  task: Task;
  projects: PlannerState["projects"];
  onChange: (patch: Partial<Task>) => void;
  onToggle: (completed: boolean) => void;
  onDelete?: () => void;
  onSkip?: () => void;
  showActions?: boolean;
  showHint?: boolean;
  referenceDay?: string;
  referenceInstant?: string;
  onValidityChange?: (valid:boolean)=>void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [jalaliDate, setJalaliDate] = useState(persianDateValue(task.deadline));
  const [repeatStart,setRepeatStart]=useState(task.recurrence?persianDateValue(dateWithTime(task.recurrence.startDay,"12:00")):"");
  const [repeatEnd,setRepeatEnd]=useState(task.recurrence?.endDay?persianDateValue(dateWithTime(task.recurrence.endDay,"12:00")):"");
  const todayDay=referenceDay??tehranReferenceTime(new Date()).day;
  const invalidDate=jalaliDate.trim().length>0&&!persianToGregorian(jalaliDate);
  const invalidRepeat=Boolean(task.recurrence)&&(!persianToGregorian(repeatStart)||Boolean(repeatEnd&&!persianToGregorian(repeatEnd)));
  useEffect(()=>onValidityChange?.(!invalidDate&&!invalidRepeat),[invalidDate,invalidRepeat,onValidityChange]);
  const relativeDays=invalidDate?"":task.deadline?deadlineDayOffset(task.deadline,todayDay):"";
  useEffect(() => setJalaliDate(persianDateValue(task.deadline)), [task.id, task.deadline]);
  useEffect(()=>{setRepeatStart(task.recurrence?persianDateValue(dateWithTime(task.recurrence.startDay,"12:00")):"");setRepeatEnd(task.recurrence?.endDay?persianDateValue(dateWithTime(task.recurrence.endDay,"12:00")):"")},[task.id,task.recurrence?.startDay,task.recurrence?.endDay]);
  const project = projects.find(item => item.id === task.projectId);
  const durationHours = Math.floor(task.duration / 60);
  const durationMinutes = task.duration % 60;
  const timeValue = localClock(task.deadline);
  const setDuration = (hours: number, minutes: number) => onChange({ duration: Math.max(1, hours * 60 + minutes), estimateSource: "manual" });
  const setDeadlineDate = (value: string) => {
    if (!value) { onChange({ deadline: undefined,deadlineKind:"none" }); return; }
    const gregorian = persianToGregorian(value);
    if (gregorian) onChange({ deadline: dateWithTime(gregorian, timeValue),deadlineKind:task.deadlineKind==="none"?"flexible":task.deadlineKind });
  };
  const setDeadlineTime = (value: string) => {
    if (task.deadline) {
      const parts = tehranParts(task.deadline);
      const day = `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}-${parts.find(part => part.type === "day")?.value}`;
      onChange({ deadline: dateWithTime(day, value) });
    }
  };
  const patchStages=(stages:NonNullable<Task["stages"]>)=>{
    const complete=stages.length>0&&stages.every(stage=>stage.completed);
    const instant=referenceInstant??new Date().toISOString();
    onChange({stages,duration:stages.length?stages.reduce((sum,stage)=>sum+stage.duration,0):task.duration,estimateSource:"manual",
      completed:complete,completedAt:complete?(task.completedAt??instant):undefined,completedDay:complete?(task.completedDay??todayDay):undefined,
      completionRecords:complete&&!task.completed?[...(task.completionRecords??[]),{day:todayDay,completedAt:instant}]:task.completionRecords});
  };
  const recurrence=task.recurrence;
  const setRecurrence=(patch:Partial<NonNullable<Task["recurrence"]>>)=>onChange({recurrence:{frequency:"daily",startDay:todayDay,interval:1,sameDay:false,...recurrence,...patch}});

  return <div className="editorGrid taskEditorGrid">
    {showHint && <p className="editorHint">Changes save automatically.</p>}
    {task.targetDay&&<p className="editorHint">Occurrence · {new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"medium",timeZone:"Asia/Tehran"}).format(new Date(`${task.targetDay}T12:00:00Z`))}</p>}
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
        <input type="radio" name={`deadline-${task.id}`} checked={task.deadlineKind === value} onChange={() => onChange(value==="none"?{deadlineKind:value,deadline:undefined}:{deadlineKind:value})} />{label}
      </label>)}
    </div></fieldset>
    <fieldset className="taskDeadlineField"><legend>Deadline · شمسی</legend><div className="deadlineInputs">
      <label><span className="srOnly">Persian date, year/month/day</span><input dir="ltr" inputMode="numeric" placeholder="۱۴۰۵/۰۸/۱۹" aria-label="Deadline Persian date" aria-invalid={Boolean(invalidDate)} value={jalaliDate} onChange={event => { setJalaliDate(event.target.value); setDeadlineDate(event.target.value); }} /></label>
      <label><span className="srOnly">Time</span><input dir="ltr" type="time" aria-label="Deadline time" value={task.deadline ? timeValue : "12:00"} disabled={!task.deadline} onChange={event => setDeadlineTime(event.target.value)} /></label>
      <label><span className="srOnly">Days from today</span><input dir="ltr" type="number" step="1" aria-label="Days from today" placeholder="Days" value={relativeDays} onChange={event=>{const raw=event.target.value;if(raw===""){setJalaliDate("");onChange({deadline:undefined,deadlineKind:"none"});return}const count=Number(raw);if(!Number.isInteger(count)||Math.abs(count)>36500)return;const target=dayOffset(todayDay,count);const stamp=dateWithTime(target,timeValue);setJalaliDate(persianDateValue(stamp));onChange({deadline:stamp,deadlineKind:task.deadlineKind==="none"?"flexible":task.deadlineKind})}}/></label>
    </div>{invalidDate&&<small role="alert">Enter a valid Persian date</small>}{typeof relativeDays==="number"&&relativeDays<0&&<small>Past · {Math.abs(relativeDays)} days</small>}</fieldset>
    <RatingField label="Importance" value={task.importance} onChange={value => onChange({ importance: value })} />
    <RatingField label="Urgency" value={task.urgency} onChange={value => onChange({ urgency: value })} />
    <details className="taskAdvanced"><summary>Advanced {task.stages?.length?`· ${task.stages.length} stages`:""}{recurrence?` · ${recurrence.frequency}`:""}</summary>
      <div className="advancedContent"><div className="advancedHeading"><strong>Stages</strong><button type="button" onClick={()=>patchStages([...(task.stages??[]),{id:crypto.randomUUID(),title:"",duration:30,completed:false}])}>+ Add stage</button></div>
      {task.stages?.map((stage,index)=><div className="stageEditor" key={stage.id}><span>{String(index+1).padStart(2,"0")}</span><input aria-label={`Stage ${index+1} title`} placeholder="Stage title" value={stage.title} onChange={event=>patchStages(task.stages!.map(item=>item.id===stage.id?{...item,title:event.target.value}:item))}/><input aria-label={`Stage ${index+1} minutes`} type="number" min="1" value={stage.duration} onChange={event=>patchStages(task.stages!.map(item=>item.id===stage.id?{...item,duration:Math.max(1,Number(event.target.value)||1)}:item))}/><button type="button" aria-label={`Move stage ${index+1} up`} disabled={index===0} onClick={()=>{const copy=[...task.stages!];[copy[index-1],copy[index]]=[copy[index],copy[index-1]];patchStages(copy)}}>↑</button><button type="button" aria-label={`Move stage ${index+1} down`} disabled={index===task.stages!.length-1} onClick={()=>{const copy=[...task.stages!];[copy[index+1],copy[index]]=[copy[index],copy[index+1]];patchStages(copy)}}>↓</button><button type="button" aria-label={`Delete stage ${index+1}`} onClick={()=>patchStages(task.stages!.filter(item=>item.id!==stage.id))}>×</button><label className="stageDone"><input type="checkbox" checked={stage.completed} onChange={event=>patchStages(task.stages!.map(item=>item.id===stage.id?{...item,completed:event.target.checked,completedAt:event.target.checked?(referenceInstant??new Date().toISOString()):undefined,completedDay:event.target.checked?todayDay:undefined,parentActionId:undefined}:item))}/>Done</label></div>)}
      <div className="advancedHeading"><strong>Repeat</strong><select aria-label="Repeat frequency" value={recurrence?.frequency??"none"} onChange={event=>event.target.value==="none"?onChange({recurrence:undefined}):setRecurrence({frequency:event.target.value as "daily"|"weekly"})}><option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></div>
      {recurrence&&<div className="recurrenceEditor"><label>Start · شمسی<input aria-label="Repeat start Persian date" aria-invalid={!persianToGregorian(repeatStart)} value={repeatStart} onChange={event=>{setRepeatStart(event.target.value);const day=persianToGregorian(event.target.value);if(day)setRecurrence({startDay:day})}}/></label><label>Every<input aria-label="Repeat interval" type="number" min="1" value={recurrence.interval} onChange={event=>setRecurrence({interval:Math.max(1,Number(event.target.value)||1)})}/></label><label>End · شمسی<input aria-label="Repeat end Persian date" aria-invalid={Boolean(repeatEnd&&!persianToGregorian(repeatEnd))} placeholder="Optional" value={repeatEnd} onChange={event=>{setRepeatEnd(event.target.value);if(!event.target.value)setRecurrence({endDay:undefined});else{const day=persianToGregorian(event.target.value);if(day)setRecurrence({endDay:day})}}}/></label>{recurrence.frequency==="weekly"&&<div className="recurrenceDays" aria-label="Repeat weekdays">{[[6,"Sa"],[0,"Su"],[1,"Mo"],[2,"Tu"],[3,"We"],[4,"Th"],[5,"Fr"]].map(([day,label])=><label key={day}><input type="checkbox" checked={recurrence.weekdays?.includes(Number(day))??false} onChange={event=>setRecurrence({weekdays:event.target.checked?[...(recurrence.weekdays??[]),Number(day)]:(recurrence.weekdays??[]).filter(item=>item!==day)})}/>{label}</label>)}</div>}<label><input type="checkbox" checked={recurrence.sameDay} onChange={event=>setRecurrence({sameDay:event.target.checked})}/>Must be on target day</label></div>}{task.recurrenceSourceId&&onSkip&&!task.completed&&!task.skipped&&<button type="button" onClick={onSkip}>Skip this occurrence</button>}
      </div>
    </details>
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

import { Appointment, Conflict, Draft, PlanItem, Task } from "./types";
import { remainingStart, tehranReferenceTime, type ReferenceTime } from "./referenceTime";

export const WORK_START=9*60, WORK_END=24*60, DEFAULT_RATIO=2/3;
export type Interval={start:number;end:number};
export type Capacity={freeMinutes:number;workBudget:number;effectiveCapacity:number;free:Interval[]};

export function mergeIntervals(items:Interval[]):Interval[]{
  const sorted=items.filter(x=>x.end>x.start).sort((a,b)=>a.start-b.start); const out:Interval[]=[];
  for(const item of sorted){const last=out.at(-1); if(last&&item.start<=last.end) last.end=Math.max(last.end,item.end); else out.push({...item});} return out;
}
export function freeIntervals(appointments:Appointment[], day:string, nowMinute?:number):Interval[]{
  const start=Math.max(WORK_START,nowMinute??WORK_START);
  const busy=mergeIntervals(appointments.filter(a=>a.day===day&&a.blocking).map(a=>({start:Math.max(start,a.start),end:Math.min(WORK_END,a.end)})));
  const free:Interval[]=[]; let cursor=start; for(const b of busy){if(b.start>cursor)free.push({start:cursor,end:b.start});cursor=Math.max(cursor,b.end);} if(cursor<WORK_END)free.push({start:cursor,end:WORK_END}); return free;
}
export function capacityForDay(appointments:Appointment[],day:string,manual?:number,nowMinute?:number):Capacity{
  const free=freeIntervals(appointments,day,nowMinute); const freeMinutes=free.reduce((n,x)=>n+x.end-x.start,0); const workBudget=manual??Math.floor(freeMinutes*DEFAULT_RATIO); return {freeMinutes,workBudget,effectiveCapacity:Math.min(freeMinutes,workBudget),free};
}
/** Capacity remaining on a Tehran calendar day relative to an explicit clock. */
export function capacityForReferenceDay(appointments:Appointment[],day:string,reference:ReferenceTime,manual?:number):Capacity{
  return capacityForDay(appointments,day,manual,remainingStart(day,reference));
}
function fit(intervals:Interval[],duration:number,used:Interval[]):Interval|undefined{
  const occupied=mergeIntervals(used); for(const base of intervals){let cursor=base.start; for(const b of occupied){if(b.end<=cursor||b.start>=base.end)continue;if(b.start-cursor>=duration)return{start:cursor,end:cursor+duration};cursor=Math.max(cursor,b.end);}if(base.end-cursor>=duration)return{start:cursor,end:cursor+duration};}
}
export function validate(items:PlanItem[],tasks:Task[],appointments:Appointment[],budgets:Record<string,number>,reference?:ReferenceTime):Conflict[]{
  const conflicts:Conflict[]=[]; const days=[...new Set(items.map(i=>i.day))];
  for(const day of days){const dayItems=items.filter(i=>i.day===day&& !tasks.find(t=>t.id===i.taskId)?.completed);const total=dayItems.reduce((n,i)=>n+(tasks.find(t=>t.id===i.taskId)?.duration??0),0);const cap=capacityForDay(appointments,day,budgets[day],reference?remainingStart(day,reference):undefined);if(total>cap.effectiveCapacity)conflicts.push({type:"capacity",day,minutes:total-cap.effectiveCapacity,message:`${total-cap.effectiveCapacity} دقیقه کسری ظرفیت`});const used:Interval[]=[];for(const item of dayItems){const task=tasks.find(t=>t.id===item.taskId);if(!task)continue;const slot=fit(cap.free,task.duration,used);if(!slot)conflicts.push({type:"continuity",day,taskId:task.id,message:`«${task.title}» بازهٔ پیوسته ندارد`});else used.push(slot);if(task.deadline){const deadline=tehranReferenceTime(new Date(task.deadline));if(day>deadline.day||(day===deadline.day&&(!slot||slot.end>deadline.minute)))conflicts.push({type:"deadline",day,taskId:task.id,message:`«${task.title}» از موعد عبور می‌کند`});}}}
  return conflicts;
}
export function makeDraft(tasks:Task[],days:string[],appointments:Appointment[],budgets:Record<string,number>,revision:number,taskOrder?:Task[],reference?:ReferenceTime):Draft{
  const defaultOrder=(a:Task,b:Task)=>Number(b.deadlineKind==="hard")-Number(a.deadlineKind==="hard")||(b.importance??0)-(a.importance??0)||(b.urgency??0)-(a.urgency??0);const open=taskOrder?taskOrder.filter(t=>!t.completed&&tasks.some(source=>source.id===t.id)):tasks.filter(t=>!t.completed).sort(defaultOrder);const items:PlanItem[]=[];
  for(const task of open){let placed=false;for(const day of days){const candidate=[...items,{taskId:task.id,day}];if(!validate(candidate,tasks,appointments,budgets,reference).some(c=>c.taskId===task.id||c.day===day&&c.type==="capacity")){items.push({taskId:task.id,day});placed=true;break;}}if(!placed)items.push({taskId:task.id,day:days[0],conflict:"در این چینش جا نگرفت"});}
  return{id:crypto.randomUUID(),baseRevision:revision,createdAt:new Date().toISOString(),items,conflicts:validate(items,tasks,appointments,budgets,reference)};
}

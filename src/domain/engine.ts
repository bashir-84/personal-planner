import { Appointment, Conflict, Draft, PlanChange, PlanItem, Task, UnscheduledItem } from "./types";
import { remainingStart, tehranReferenceTime, type ReferenceTime } from "./referenceTime";
import {remainingDuration} from "./taskStructure";

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
export function fitSlot(intervals:Interval[],duration:number,used:Interval[],latestEnd=WORK_END):Interval|undefined{
  if(duration<=0)return undefined;
  const occupied=mergeIntervals(used); for(const base of intervals){let cursor=base.start;const end=Math.min(base.end,latestEnd);if(cursor>=end)continue;for(const b of occupied){if(b.end<=cursor||b.start>=end)continue;if(b.start-cursor>=duration)return{start:cursor,end:cursor+duration};cursor=Math.max(cursor,b.end);}if(end-cursor>=duration)return{start:cursor,end:cursor+duration};}
}
export function planItemDuration(item:PlanItem,tasks:Task[]):number{
  const task=tasks.find(t=>t.id===item.taskId);if(!task)return 0;
  return item.stageId?task.stages?.find(stage=>stage.id===item.stageId&&!stage.completed)?.duration??0:remainingDuration(task);
}
export function validate(items:PlanItem[],tasks:Task[],appointments:Appointment[],budgets:Record<string,number>,reference?:ReferenceTime):Conflict[]{
  const conflicts:Conflict[]=[]; const days=[...new Set(items.map(i=>i.day))];
  for(const day of days){const dayItems=items.filter(i=>i.day===day&&planItemDuration(i,tasks)>0);const total=dayItems.reduce((n,i)=>n+planItemDuration(i,tasks),0);const cap=capacityForDay(appointments,day,budgets[day],reference?remainingStart(day,reference):undefined);if(total>cap.effectiveCapacity)conflicts.push({type:"capacity",day,minutes:total-cap.effectiveCapacity,message:`${total-cap.effectiveCapacity} دقیقه کسری ظرفیت`});const used:Interval[]=[];for(const item of dayItems){const task=tasks.find(t=>t.id===item.taskId);if(!task)continue;const slot=fitSlot(cap.free,planItemDuration(item,tasks),used);if(!slot)conflicts.push({type:"continuity",day,taskId:task.id,message:`«${task.title}» بازهٔ پیوسته ندارد`});else used.push(slot);if(task.deadline){const deadline=tehranReferenceTime(new Date(task.deadline));if(day>deadline.day||(day===deadline.day&&(!slot||slot.end>deadline.minute)))conflicts.push({type:"deadline",day,taskId:task.id,message:`«${task.title}» از موعد عبور می‌کند`});}}}
  for(const task of tasks.filter(task=>task.stages?.length)){
    let previous:PlanItem|undefined;
    for(const stage of task.stages??[]){const item=items.find(item=>item.taskId===task.id&&item.stageId===stage.id);if(!item)continue;
      if(previous&&(item.day<previous.day||(item.day===previous.day&&items.indexOf(item)<items.indexOf(previous))))conflicts.push({type:"order",day:item.day,taskId:task.id,message:`«${task.title}» stages are out of order`});
      previous=item;
    }
  }
  const warnedTargets=new Set<string>();
  for(const item of items){const task=tasks.find(task=>task.id===item.taskId);if(!task?.recurrenceSourceId||!task.targetDay||warnedTargets.has(task.id))continue;
    const template=tasks.find(source=>source.id===task.recurrenceSourceId);
    if(template?.recurrence?.sameDay&&item.day!==task.targetDay){conflicts.push({type:"target",day:item.day,taskId:task.id,message:`«${task.title}» missed required day ${task.targetDay}`});warnedTargets.add(task.id)}
  }
  return conflicts;
}
/** Importance 12, urgency 8, hard commitment 14, deadline proximity up to 12,
 * last fitting day 20. Duration only breaks ties; IDs break final ties. */
export function priorityScore(task:Task,days:string[],appointments:Appointment[],reference?:ReferenceTime,budgets:Record<string,number>={}):number{
  const deadline=task.deadline?tehranReferenceTime(new Date(task.deadline)):undefined;
  let score=(task.importance??3)*12+(task.urgency??3)*8+(task.deadlineKind==="hard"?14:0);
  if(deadline){const eligible=days.filter(day=>day<=deadline.day);
    score+=Math.max(0,12-eligible.length*2);
    const piece=task.stages?.find(stage=>!stage.completed)?.duration??remainingDuration(task);
    const fitting=eligible.filter(day=>{const cap=capacityForDay(appointments,day,budgets[day],reference?remainingStart(day,reference):undefined);return cap.effectiveCapacity>=piece&&fitSlot(cap.free,piece,[],day===deadline.day?deadline.minute:WORK_END)});
    if(fitting.length===1)score+=20;
  }
  return score;
}

export function comparePlans(current:PlanItem[],proposed:PlanItem[]):PlanChange[]{
  const changes:PlanChange[]=[];
  for(const item of proposed){const old=current.find(previous=>previous.taskId===item.taskId&&previous.stageId===item.stageId);
    if(!old)changes.push({taskId:item.taskId,kind:"added",to:item.day});
    else if(old.day!==item.day)changes.push({taskId:item.taskId,kind:"moved",from:old.day,to:item.day});
    else if(current.filter(previous=>previous.day===item.day).findIndex(previous=>previous.taskId===item.taskId&&previous.stageId===item.stageId)!==proposed.filter(previous=>previous.day===item.day).findIndex(previous=>previous.taskId===item.taskId&&previous.stageId===item.stageId))changes.push({taskId:item.taskId,kind:"reordered",from:item.day,to:item.day});
  }
  for(const item of current)if(!proposed.some(next=>next.taskId===item.taskId&&next.stageId===item.stageId))changes.push({taskId:item.taskId,kind:"removed",from:item.day});
  return changes;
}

export function makeDraft(tasks:Task[],days:string[],appointments:Appointment[],budgets:Record<string,number>,revision:number,taskOrder?:Task[],reference?:ReferenceTime,current:PlanItem[]=[],preferences:PlanItem[]=current):Draft{
  const open=(taskOrder??tasks).filter(t=>!t.completed&&!t.skipped&&!t.recurrence&&tasks.some(source=>source.id===t.id));
  if(!taskOrder)open.sort((a,b)=>priorityScore(b,days,appointments,reference,budgets)-priorityScore(a,days,appointments,reference,budgets)||a.duration-b.duration||a.id.localeCompare(b.id));
  const items:PlanItem[]=[];const unscheduled:UnscheduledItem[]=[];
  for(const task of open){const deadline=task.deadline?tehranReferenceTime(new Date(task.deadline)):undefined;
    const overdue=!!deadline&&!!reference&&(deadline.day<reference.day||(deadline.day===reference.day&&deadline.minute<reference.minute));
    const template=tasks.find(source=>source.id===task.recurrenceSourceId);
    const pieces=task.stages?.length?task.stages.filter(stage=>!stage.completed).map(stage=>({stageId:stage.id,duration:stage.duration})): [{stageId:undefined,duration:task.duration}];
    let earliest=days[0];let previousEnd=0;
    for(const [pieceIndex,piece] of pieces.entries()){
    const old=preferences.find(item=>item.taskId===task.id&&item.stageId===piece.stageId);
    const candidates=[...days].filter(day=>day>=earliest).sort((a,b)=>Number(b===old?.day)-Number(a===old?.day)||a.localeCompare(b));
    let placed=false,hadBudget=false;
    for(const day of candidates){if(reference&&day<reference.day)continue;if(task.recurrenceSourceId&&task.targetDay&&task.targetDay>day)continue;
      if(template?.recurrence?.sameDay&&day!==task.targetDay&&!(reference&&task.targetDay&&task.targetDay<reference.day))continue;
      const cap=capacityForDay(appointments,day,budgets[day],reference?remainingStart(day,reference):undefined);
      const sameDay=items.filter(item=>item.day===day);
      const used=sameDay.reduce((sum,item)=>sum+planItemDuration(item,tasks),0);
      if(used+piece.duration>cap.effectiveCapacity)continue;
      hadBudget=true;
      if(deadline&&!overdue&&task.deadlineKind==="hard"&&day>deadline.day)continue;
      const occupied=sameDay.flatMap(item=>item.start!==undefined&&item.end!==undefined?[{start:item.start,end:item.end}]:[]);
      const latestEnd=deadline&&!overdue&&task.deadlineKind==="hard"&&day===deadline.day?deadline.minute:WORK_END;
      const stageFree=cap.free.map(interval=>({...interval,start:Math.max(interval.start,day===earliest?previousEnd:0)})).filter(interval=>interval.end>interval.start);
      const slot=fitSlot(stageFree,piece.duration,occupied,latestEnd);
      if(!slot)continue;
      const reason=old?.day===day?(old.reason==="Manual choice"?"Manual choice":"Keep manual plan"):overdue?"Overdue · next fit":deadline&&day===deadline.day?"Deadline soon":piece.duration<=60?"Fits available time":"Priority fit";
      items.push({taskId:task.id,stageId:piece.stageId,day,start:slot.start,end:slot.end,reason});placed=true;earliest=day;previousEnd=slot.end;break;
    }
    if(!placed){const status:UnscheduledItem["status"]=piece.duration>WORK_END-WORK_START?"split":deadline&&!overdue&&task.deadlineKind==="hard"?"deadline":hadBudget?"no-slot":"waiting";
      const reason=template?.recurrence?.sameDay&&task.targetDay&&(!reference||task.targetDay>=reference.day)?(hadBudget?"Required day has no slot":"Required day over capacity"):{split:"Split required",deadline:"Deadline conflict","no-slot":"No continuous slot",waiting:"Waiting for capacity"}[status];
      unscheduled.push({taskId:task.id,...(piece.stageId?{stageId:piece.stageId}:{}),status,reason});
      for(const remaining of pieces.slice(pieceIndex+1))unscheduled.push({taskId:task.id,...(remaining.stageId?{stageId:remaining.stageId}:{}),status:"waiting",reason:"Waiting for previous stage"});
      break;}
    }
  }
  return{id:crypto.randomUUID(),baseRevision:revision,createdAt:new Date().toISOString(),items,unscheduled,changes:comparePlans(current,items),conflicts:validate(items,tasks,appointments,budgets,reference)};
}

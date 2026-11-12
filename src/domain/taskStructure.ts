import type {Task,TaskStage} from "./types";
import {dayNumber,dayOffset} from "./calendarDays";

export function totalDuration(task:Task):number{return task.stages?.length?task.stages.reduce((sum,stage)=>sum+stage.duration,0):task.duration}
export function remainingDuration(task:Task):number{return task.completed||task.skipped?0:task.stages?.length?task.stages.filter(stage=>!stage.completed).reduce((sum,stage)=>sum+stage.duration,0):task.duration}

export function setStageCompleted(task:Task,stageId:string,completed:boolean,completedAt:string,day:string):Task{
  const stages=task.stages?.map(stage=>stage.id===stageId?{...stage,completed,completedAt:completed?completedAt:undefined,completedDay:completed?day:undefined,parentActionId:undefined}:stage);
  if(!stages)return task;
  return {...task,stages,completed:stages.every(stage=>stage.completed),duration:stages.reduce((sum,stage)=>sum+stage.duration,0)};
}

/** Undoing a parent completion only reopens stages touched by that exact action. */
export function setParentCompleted(task:Task,completed:boolean,completedAt:string,day:string,actionId:string):Task{
  if(completed){
    const stages=task.stages?.map(stage=>stage.completed?stage:{...stage,completed:true,completedAt,completedDay:day,parentActionId:actionId});
    return {...task,completed:true,completedAt,completedDay:day,parentCompletionActionId:actionId,stages,
      completionRecords:[...(task.completionRecords??[]),{day,completedAt}]};
  }
  const stages=task.stages?.map(stage=>stage.parentActionId===task.parentCompletionActionId?{...stage,completed:false,completedAt:undefined,completedDay:undefined,parentActionId:undefined}:stage);
  return {...task,completed:false,completedAt:undefined,completedDay:undefined,parentCompletionActionId:undefined,stages};
}

const weekday=(day:string)=>new Date(`${day}T12:00:00Z`).getUTCDay();
const weekNumber=(day:string)=>Math.floor((dayNumber(day)-((weekday(day)+1)%7))/7);
export function recurrenceDays(task:Task,throughDay:string):string[]{
  const rule=task.recurrence;if(!rule)return[];
  const end=rule.endDay&&rule.endDay<throughDay?rule.endDay:throughDay;
  const interval=Math.max(1,Math.floor(rule.interval)||1);
  const days:string[]=[];
  // Generate a bounded lookback plus the visible future; persisted older
  // instances remain untouched and can still be completed or skipped.
  const windowStart=dayOffset(throughDay,-180);
  const first=rule.startDay>windowStart?rule.startDay:windowStart;
  for(let day=first;day<=end;day=dayOffset(day,1)){
    if(rule.frequency==="daily"){
      if((dayNumber(day)-dayNumber(rule.startDay))%interval===0)days.push(day);
    }else if((weekNumber(day)-weekNumber(rule.startDay))%interval===0&&(rule.weekdays?.length?rule.weekdays.includes(weekday(day)):weekday(day)===weekday(rule.startDay)))days.push(day);
  }
  return days;
}

/** Existing instances are immutable snapshots; repeated expansion is idempotent. */
export function expandRecurrences(tasks:Task[],throughDay:string):Task[]{
  const ids=new Set(tasks.map(task=>task.id));
  const added:Task[]=[];
  for(const template of tasks.filter(task=>task.recurrence&&!task.recurrenceSourceId)){
    for(const day of recurrenceDays(template,throughDay)){
      const id=`${template.id}@${day}`;
      if(ids.has(id))continue;
      const stages=template.stages?.map((stage:TaskStage)=>({...stage,id:`${stage.id}@${day}`,completed:false,completedAt:undefined,completedDay:undefined,parentActionId:undefined}));
      added.push({...template,id,trackedSeconds:0,timerStartedAt:undefined,recurrence:undefined,recurrenceSourceId:template.id,targetDay:day,skipped:false,completed:false,completedAt:undefined,completedDay:undefined,completionRecords:[],stages});
      ids.add(id);
    }
  }
  return [...tasks,...added];
}

export function skipInstance(task:Task):Task{return task.recurrenceSourceId?{...task,skipped:true,completed:false}:task}

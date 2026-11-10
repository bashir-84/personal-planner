import {describe,expect,it} from "vitest";
import {comparePlans,makeDraft,priorityScore,validate} from "./engine";
import {dayOffset,deadlineDayOffset} from "./calendarDays";
import {expandRecurrences,remainingDuration,setParentCompleted,skipInstance} from "./taskStructure";
import type {Task} from "./types";

const day="2026-11-10";
const base=(id:string,duration=60):Task=>({id,title:id,duration,estimateSource:"manual",deadlineKind:"none",completed:false,createdAt:"2026-11-09T12:00:00Z"});
describe("planning upgrades",()=>{
  it("leaves a nonfitting task unscheduled instead of inventing a day-one slot",()=>{
    const task=base("long",1200);const draft=makeDraft([task],[day],[],{},0,undefined,{day,minute:540});
    expect(draft.items).toHaveLength(0);expect(draft.unscheduled).toEqual([{taskId:"long",status:"split",reason:"Split required"}]);
  });
  it("distinguishes enough daily minutes from a missing continuous slot",()=>{
    const task=base("block",120);
    const appointments=[{id:"a",title:"",day,start:600,end:660,blocking:true},{id:"b",title:"",day,start:720,end:1380,blocking:true}];
    const draft=makeDraft([task],[day],appointments,{[day]:120},0,undefined,{day,minute:540});
    expect(draft.items).toHaveLength(0);expect(draft.unscheduled?.[0].status).toBe("no-slot");
  });
  it("keeps priority score deterministic and gives a unique last deadline slot a boost",()=>{
    const task={...base("urgent",90),deadlineKind:"hard" as const,deadline:"2026-11-11T08:30:00Z",importance:4,urgency:2};
    const days=[day,"2026-11-11"];
    const first=priorityScore(task,days,[],{day,minute:540});
    expect(first).toBe(priorityScore(task,days,[],{day,minute:540}));
    expect(first).toBeGreaterThan(priorityScore({...task,deadline:undefined,deadlineKind:"none"},days,[],{day,minute:540}));
  });
  it("schedules an overdue hard deadline today with a warning and leaves its original deadline intact",()=>{
    const task={...base("late"),deadlineKind:"hard" as const,deadline:"2026-11-08T09:00:00Z"};
    const draft=makeDraft([task],[day],[],{},0,undefined,{day,minute:600});
    expect(draft.items[0].day).toBe(day);expect(draft.conflicts.some(item=>item.type==="deadline")).toBe(true);expect(task.deadline).toBe("2026-11-08T09:00:00Z");
  });
  it("preserves a feasible manual day and reports movement when it must change",()=>{
    const task=base("manual");const current=[{taskId:task.id,day:"2026-11-11"}];
    const kept=makeDraft([task],[day,"2026-11-11"],[],{},0,undefined,{day,minute:540},current);
    expect(kept.items[0].day).toBe("2026-11-11");expect(kept.items[0].reason).toBe("Keep manual plan");
    const moved=makeDraft([task],[day],[],{},0,undefined,{day,minute:540},current);
    expect(comparePlans(current,moved.items)).toContainEqual({taskId:task.id,kind:"moved",from:"2026-11-11",to:day});
  });
  it("keeps each stage contiguous and orders stages across days without parent double count",()=>{
    const task={...base("staged",180),stages:[{id:"a",title:"A",duration:90,completed:false},{id:"b",title:"B",duration:90,completed:false}]};
    const draft=makeDraft([task],[day,"2026-11-11"],[],{[day]:90,"2026-11-11":90},0,undefined,{day,minute:540});
    expect(draft.items.map(item=>[item.stageId,item.day])).toEqual([["a",day],["b","2026-11-11"]]);
    expect(validate(draft.items,[task],[],{[day]:90,"2026-11-11":90},{day,minute:540})).toHaveLength(0);
  });
  it("undoes only stages completed by its parent action",()=>{
    const task={...base("parent",120),stages:[{id:"a",title:"A",duration:60,completed:true},{id:"b",title:"B",duration:60,completed:false}]};
    const done=setParentCompleted(task,true,"2026-11-10T10:00:00Z",day,"action");
    expect(remainingDuration(done)).toBe(0);
    const undone=setParentCompleted(done,false,"",day,"unused");
    expect(undone.stages?.map(stage=>stage.completed)).toEqual([true,false]);expect(remainingDuration(undone)).toBe(60);
  });
  it("creates stable independent recurrence instances and supports skip",()=>{
    const template={...base("weekly"),stages:[{id:"one",title:"One",duration:60,completed:false}],recurrence:{frequency:"weekly" as const,startDay:day,interval:1,weekdays:[2],sameDay:true}};
    const expanded=expandRecurrences([template],"2026-11-24");
    expect(expandRecurrences(expanded,"2026-11-24")).toHaveLength(expanded.length);
    const instances=expanded.filter(task=>task.recurrenceSourceId===template.id);
    expect(instances.map(task=>task.targetDay)).toEqual([day,"2026-11-17","2026-11-24"]);
    expect(instances[0].stages?.[0].id).not.toBe(instances[1].stages?.[0].id);
    expect(skipInstance(instances[0]).skipped).toBe(true);expect(instances[1].skipped).toBe(false);
  });
  it("uses calendar days for relative deadlines across a Gregorian year",()=>{
    expect(dayOffset("2026-12-30",4)).toBe("2027-01-03");
    expect(deadlineDayOffset("2027-01-03T08:30:00Z","2026-12-30")).toBe(4);
  });
});

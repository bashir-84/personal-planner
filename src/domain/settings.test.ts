import {describe,expect,it} from "vitest";
import type {Appointment,Task} from "./types";
import {capacityForDay,makeDraft} from "./engine";
import {DEFAULT_SETTINGS,normalizeSettings} from "./settings";

const day="2026-11-14"; // Saturday
const task:Task={id:"t",title:"Work",duration:300,estimateSource:"manual",deadlineKind:"none",completed:false,createdAt:""};

describe("planner settings",()=>{
  it("changes capacity and placement when work hours and ratio change",()=>{
    const settings=normalizeSettings({...DEFAULT_SETTINGS,general:{...DEFAULT_SETTINGS.general,workStart:10*60,workEnd:18*60,workRatio:.5}});
    expect(capacityForDay([],day,undefined,undefined,settings)).toMatchObject({freeMinutes:480,workBudget:240,effectiveCapacity:240});
    expect(makeDraft([task],[day],[],{},0,undefined,undefined,[],[],settings).items).toHaveLength(0);
  });

  it("gives inactive days zero automatic capacity but permits a warned manual override",()=>{
    const settings=normalizeSettings({...DEFAULT_SETTINGS,general:{...DEFAULT_SETTINGS.general,activeWeekdays:[0,1,2,3,4,5]}});
    expect(capacityForDay([],day,undefined,undefined,settings).effectiveCapacity).toBe(0);
    const draft=makeDraft([{...task,duration:60}],[day],[],{[day]:60},0,undefined,undefined,[],[],settings);
    expect(draft.items).toHaveLength(1);
    expect(draft.conflicts.map(conflict=>conflict.type)).toContain("inactive");
  });

  it("merges overlapping appointments before applying the exact ratio",()=>{
    const appointments:Appointment[]=[{id:"a",title:"A",day,start:600,end:720,blocking:true},{id:"b",title:"B",day,start:660,end:780,blocking:true}];
    const capacity=capacityForDay(appointments,day,undefined,undefined,DEFAULT_SETTINGS);
    expect(capacity.freeMinutes).toBe(720);
    expect(capacity.workBudget).toBe(480);
  });

  it("migrates missing and invalid values to centralized defaults",()=>{
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({general:{...DEFAULT_SETTINGS.general,workRatio:2}}).general.workRatio).toBe(1);
    expect(normalizeSettings({general:{...DEFAULT_SETTINGS.general,defaultImportance:9,defaultUrgency:-1}}).general).toMatchObject({defaultImportance:5,defaultUrgency:1});
  });
});

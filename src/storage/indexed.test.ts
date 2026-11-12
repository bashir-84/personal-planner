import "fake-indexeddb/auto";
import {beforeEach,describe,expect,it} from "vitest";
import {emptyState} from "./local";
import {commitIndexedPlanner,getSyncContext,loadIndexedPlanner} from "./indexed";

const removeDb=()=>new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase("personal-planner");request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);request.onblocked=()=>resolve()});
beforeEach(removeDb);

describe("IndexedDB planner storage",()=>{
  it("migrates the supplied legacy state without losing personal data",async()=>{const legacy={...structuredClone(emptyState),tasks:[{id:"legacy",title:"Legacy task",duration:30,estimateSource:"default" as const,deadlineKind:"none" as const,completed:false,createdAt:""}],projects:[{id:"p",name:"Old project",color:"#000000"}]};const loaded=await loadIndexedPlanner(legacy);expect(loaded.state.tasks[0].title).toBe("Legacy task");expect(loaded.state.projects[0].name).toBe("Old project");expect(loaded.connection.deviceId).toBeTruthy()});
  it("stores a state mutation and its outbox operation together",async()=>{const{state}=await loadIndexedPlanner(emptyState);const next={...state,tasks:[{id:"new",title:"Offline task",duration:30,estimateSource:"default" as const,deadlineKind:"none" as const,completed:false,createdAt:""}],revision:1};await commitIndexedPlanner(state,next);const context=await getSyncContext();expect(context.state.tasks[0].title).toBe("Offline task");expect(context.operations).toHaveLength(1);expect(context.operations[0]).toMatchObject({entityType:"task",entityId:"new"})});
});

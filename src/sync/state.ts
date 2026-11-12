import {emptyState} from "../storage/local";
import {normalizeSettings} from "../domain/settings";
import type {PlannerState} from "@/domain/types";
import type {FieldVersion,ServerChange,SyncEntityType,SyncOperation,SyncPatch} from "./types";
import {UNSET} from "./types";

const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const unset=(value:unknown)=>Boolean(value&&typeof value==="object"&&(value as Record<string,unknown>).__plannerSyncUnset===true);
const entityKey=(type:SyncEntityType,id:string)=>`${type}\u0000${id}`;
export const versionKey=(type:SyncEntityType,id:string,field:string)=>`${entityKey(type,id)}\u0000${field}`;
export const compareVersions=(a:{clientUpdatedAt:string;operationId:string},b?:{clientUpdatedAt:string;operationId:string})=>!b||a.clientUpdatedAt>b.clientUpdatedAt||a.clientUpdatedAt===b.clientUpdatedAt&&a.operationId>b.operationId;

function fields(value:Record<string,unknown>){const copy={...value};delete copy.id;return copy}
function patchFor(before:Record<string,unknown>|undefined,after:Record<string,unknown>|undefined):SyncPatch{
  if(!after)return {__deleted:true};
  const patch:SyncPatch={};
  if(!before)patch.__deleted=false;
  for(const key of new Set([...Object.keys(before??{}),...Object.keys(after)])){
    if(key==="id")continue;const previous=before?.[key],next=after[key];
    if(!same(previous,next))patch[key]=next===undefined?UNSET:next;
  }
  return patch;
}
function operation(deviceId:string,entityType:SyncEntityType,entityId:string,patch:SyncPatch,clientUpdatedAt:string):SyncOperation|undefined{
  if(!Object.keys(patch).length)return;return{operationId:crypto.randomUUID(),deviceId,entityType,entityId,patch,clientUpdatedAt};
}
function mapById(items:Record<string,unknown>[]){return new Map(items.map(item=>[String(item.id),fields(item)]))}
function confirmedMap(state:PlannerState){return new Map(state.confirmed.map(item=>[`${item.taskId}::${item.stageId??""}`,{...item} as Record<string,unknown>]))}
function capacityMap(state:PlannerState){const days=new Set([...Object.keys(state.manualBudgets),...Object.keys(state.manualBudgetEntries??{})]);return new Map([...days].map(day=>[day,{minutes:state.manualBudgets[day]??UNSET,entry:state.manualBudgetEntries?.[day]??UNSET}]))}

export function hasSharedData(state:PlannerState){return state.tasks.length>0||state.projects.length>0||state.appointments.length>0||state.confirmed.length>0||Object.keys(state.manualBudgets).length>0||Object.keys(state.manualBudgetEntries??{}).length>0}

export function buildOperations(previous:PlannerState,next:PlannerState,deviceId:string,clientUpdatedAt=new Date().toISOString()):SyncOperation[]{
  const output:SyncOperation[]=[];
  const compareMap=(type:SyncEntityType,before:Map<string,Record<string,unknown>>,after:Map<string,Record<string,unknown>>)=>{
    for(const id of new Set([...before.keys(),...after.keys()])){const item=operation(deviceId,type,id,patchFor(before.get(id),after.get(id)),clientUpdatedAt);if(item)output.push(item)}
  };
  compareMap("task",mapById(previous.tasks as unknown as Record<string,unknown>[]),mapById(next.tasks as unknown as Record<string,unknown>[]));
  compareMap("project",mapById(previous.projects as unknown as Record<string,unknown>[]),mapById(next.projects as unknown as Record<string,unknown>[]));
  compareMap("appointment",mapById(previous.appointments as unknown as Record<string,unknown>[]),mapById(next.appointments as unknown as Record<string,unknown>[]));
  compareMap("confirmed",confirmedMap(previous),confirmedMap(next));
  compareMap("dailyCapacity",capacityMap(previous),capacityMap(next));
  const settingsPatch=patchFor(previous.settings as unknown as Record<string,unknown>,next.settings as unknown as Record<string,unknown>);const settingsOp=operation(deviceId,"settings","settings",settingsPatch,clientUpdatedAt);if(settingsOp)output.push(settingsOp);
  return output;
}

function applyFields(target:Record<string,unknown>,patch:SyncPatch){for(const[field,value]of Object.entries(patch)){if(field==="__deleted")continue;if(unset(value))delete target[field];else target[field]=structuredClone(value)}return target}
function applyEntity<T extends{id:string}>(items:T[],id:string,patch:SyncPatch):T[]{
  if(patch.__deleted===true)return items.filter(item=>item.id!==id);
  const index=items.findIndex(item=>item.id===id);const value=applyFields(index>=0?{...items[index]}:{id},patch) as T;
  return index>=0?items.map((item,position)=>position===index?value:item):[value,...items];
}
function applyConfirmed(state:PlannerState,id:string,patch:SyncPatch){if(patch.__deleted===true)return state.confirmed.filter(item=>`${item.taskId}::${item.stageId??""}`!==id);const index=state.confirmed.findIndex(item=>`${item.taskId}::${item.stageId??""}`===id);const[taskId,stageId]=id.split("::");const value=applyFields(index>=0?{...state.confirmed[index]}:{taskId,...(stageId?{stageId}:{})},patch) as PlannerState["confirmed"][number];return index>=0?state.confirmed.map((item,position)=>position===index?value:item):[...state.confirmed,value]}
function applyCapacity(state:PlannerState,day:string,patch:SyncPatch){const manualBudgets={...state.manualBudgets},manualBudgetEntries={...state.manualBudgetEntries};if(patch.__deleted===true){delete manualBudgets[day];delete manualBudgetEntries[day]}else{if("minutes"in patch){if(unset(patch.minutes))delete manualBudgets[day];else manualBudgets[day]=Number(patch.minutes)}if("entry"in patch){if(unset(patch.entry))delete manualBudgetEntries[day];else manualBudgetEntries[day]=patch.entry as NonNullable<PlannerState["manualBudgetEntries"]>[string]}}return{manualBudgets,manualBudgetEntries}}

export function applyServerChanges(current:PlannerState,changes:ServerChange[],metadata:Map<string,FieldVersion>){
  let state=structuredClone(current);const ordered=[...changes].sort((a,b)=>a.sequence-b.sequence);
  for(const change of ordered){const accepted:SyncPatch={};for(const[field,value]of Object.entries(change.patch)){const incoming={entityType:change.entityType,entityId:change.entityId,field,...change.versions[field]};const key=versionKey(change.entityType,change.entityId,field);if(compareVersions(incoming,metadata.get(key))){accepted[field]=value;metadata.set(key,incoming)}}const tombstone=change.versions.__deleted,currentTombstone=metadata.get(versionKey(change.entityType,change.entityId,"__deleted"));if(tombstone&&currentTombstone?.operationId===tombstone.operationId&&currentTombstone.clientUpdatedAt===tombstone.clientUpdatedAt)accepted.__deleted=change.patch.__deleted;const missing=change.entityType==="task"?!state.tasks.some(item=>item.id===change.entityId):change.entityType==="project"?!state.projects.some(item=>item.id===change.entityId):change.entityType==="appointment"?!state.appointments.some(item=>item.id===change.entityId):false;if(missing&&currentTombstone&&tombstone&&currentTombstone.operationId!==tombstone.operationId&&compareVersions(currentTombstone,{clientUpdatedAt:tombstone.clientUpdatedAt,operationId:tombstone.operationId}))continue;if(!Object.keys(accepted).length)continue;
    if(change.entityType==="task")state.tasks=applyEntity(state.tasks,change.entityId,accepted);
    else if(change.entityType==="project")state.projects=applyEntity(state.projects,change.entityId,accepted);
    else if(change.entityType==="appointment")state.appointments=applyEntity(state.appointments,change.entityId,accepted);
    else if(change.entityType==="confirmed")state.confirmed=applyConfirmed(state,change.entityId,accepted);
    else if(change.entityType==="dailyCapacity")Object.assign(state,applyCapacity(state,change.entityId,accepted));
    else if(change.entityType==="settings"&&accepted.__deleted!==true)state.settings=normalizeSettings(applyFields({...state.settings},accepted));
  }
  return{state:{...state,revision:state.revision+1},metadata};
}

export function emptySyncState(local:PlannerState=emptyState):PlannerState{return{...structuredClone(emptyState),notes:structuredClone(local.notes),draft:local.draft}}

import type {PlannerState} from "@/domain/types";
import {applySyncSuccess,getSyncContext,joinWithCloud,removeSyncConnection,setSyncError,startSyncConnection} from "../storage/indexed";
import type {SyncJoinMode,SyncOperation,SyncResponse} from "./types";
import {SYNC_ENDPOINT} from "./types";

let active:Promise<PlannerState>|undefined;
export function createSyncKey(){const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"")}

async function request(syncKey:string,deviceId:string,cursor:number,operations:SyncOperation[]):Promise<SyncResponse>{
  let response:Response;try{response=await fetch(SYNC_ENDPOINT,{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${syncKey}`},body:JSON.stringify({cursor,deviceId,operations})})}catch{throw new Error("Could not reach Sync. Check your internet connection and reload the latest version of the app.")}
  const body=await response.json().catch(()=>null) as SyncResponse|{ok:false;error?:{message?:string}}|null;
  if(!response.ok||!body||body.ok!==true)throw new Error(body&&body.ok===false&&body.error?.message?body.error.message:`Sync request failed (${response.status})`);
  return body;
}

async function runSync(){
  if(typeof navigator!=="undefined"&&!navigator.onLine)throw new Error("You are offline. Changes remain safely queued on this device.");
  let latest:PlannerState|undefined;
  // D1 executes each field merge independently. Small batches keep an initial
  // device upload below Worker/D1 subrequest limits and remain retry-safe.
  for(let round=0;round<100;round++){
    const{connection,operations,state}=await getSyncContext();if(!connection.syncKey)throw new Error("This device is not connected to Sync.");
    const batch=operations.slice(0,5);const response=await request(connection.syncKey,connection.deviceId,connection.cursor,batch);latest=await applySyncSuccess(response);
    if(operations.length<=batch.length)return latest;
    if(batch.length===0)return latest;
  }
  throw new Error("Some changes are still pending. Press Sync again to continue.");
}
export function syncNow(){if(active)return active;active=runSync().catch(async error=>{const message=error instanceof Error?error.message:"Sync failed";await setSyncError(message);throw error}).finally(()=>{active=undefined});return active}

export async function startSync(current:PlannerState){const key=createSyncKey();await startSyncConnection(key,current);const state=await syncNow();return{key,state}}
export async function previewCloud(syncKey:string){const{connection}=await getSyncContext();return request(syncKey.trim(),connection.deviceId,0,[])}
export async function joinSync(syncKey:string,mode:SyncJoinMode,local:PlannerState){const key=syncKey.trim();if(key.length<40)throw new Error("Sync Key is invalid.");const response=await previewCloud(key);let state=await joinWithCloud(key,response,local,mode==="merge-local");if(mode==="merge-local")state=await syncNow();return state}
export async function removeThisDevice(){await removeSyncConnection()}

"use client";
import {useEffect,useState} from "react";
import QRCode from "qrcode";
import type {PlannerState,Task} from "@/domain/types";
import {getSyncContext,listDeletedTasks,restoreDeletedTask} from "@/storage/indexed";
import {hasSharedData} from "@/sync/state";
import {joinSync,removeThisDevice,startSync,syncNow} from "@/sync/client";
import {useSyncStatus} from "@/sync/useSyncStatus";
import {Icon} from "./Icon";

export function SyncHeaderButton({onState}:{onState:(state:PlannerState)=>void}){const{summary,storageError,refresh}=useSyncStatus();const[busy,setBusy]=useState(false);async function run(){setBusy(true);await refresh(true);try{onState(await syncNow())}catch{}finally{setBusy(false);await refresh()}}const label=busy?"Syncing":summary.offline?"Offline":summary.lastError?"Sync failed":summary.pending?`Pending ${summary.pending}`:summary.connected?"Synced":"Sync";return <button className="headerSyncButton" type="button" disabled={busy||!summary.connected||summary.offline||Boolean(storageError)} onClick={run} aria-label={`Sync · ${label}`} title={summary.lastError??`Last sync: ${summary.lastSuccessfulSync??"Never"}`}><Icon name="refresh"/><span>{label}</span></button>}

export function SyncPanel({state,onState}:{state:PlannerState;onState:(state:PlannerState)=>void}){
  const{summary,storageError,refresh}=useSyncStatus();const[mode,setMode]=useState<"idle"|"join">("idle");const[keyInput,setKeyInput]=useState("");const[visibleKey,setVisibleKey]=useState<string>();const[qr,setQr]=useState<string>();const[busy,setBusy]=useState(false);const[error,setError]=useState<string>();const[deleted,setDeleted]=useState<Task[]>([]);
  const reloadDeleted=()=>listDeletedTasks().then(setDeleted).catch(()=>setDeleted([]));useEffect(()=>{void reloadDeleted()},[]);
  async function action(work:()=>Promise<PlannerState|void>){setBusy(true);setError(undefined);await refresh(true);try{const next=await work();if(next)onState(next);await refresh()}catch(value){setError(value instanceof Error?value.message:"Sync failed");await refresh()}finally{setBusy(false)}}
  async function start(){await action(async()=>{const result=await startSync(state);setVisibleKey(result.key);return result.state})}
  async function join(choice?:"use-cloud"|"merge-local"){if(!keyInput.trim())return;if(hasSharedData(state)&&!choice){setMode("join");return}await action(async()=>{const next=await joinSync(keyInput,choice??"use-cloud",state);setKeyInput("");setMode("idle");return next})}
  async function reveal(){const{connection}=await getSyncContext();if(connection.syncKey)setVisibleKey(connection.syncKey)}
  async function showQr(){const{connection}=await getSyncContext();if(connection.syncKey){setVisibleKey(connection.syncKey);setQr(await QRCode.toDataURL(connection.syncKey,{width:260,margin:2,errorCorrectionLevel:"M"}))}}
  async function restore(task:Task){await action(async()=>{const next=await restoreDeletedTask(task);await reloadDeleted();return next})}
  return <fieldset className="syncPanel"><legend>Sync</legend>
    {storageError&&<p className="settingsError">{storageError}</p>}
    <div className="syncStatus"><b>{busy?"Syncing":summary.offline?"Offline":summary.lastError?"Sync failed":summary.pending?"Pending changes":summary.connected?"Synced":"Not connected"}</b><span>Pending changes: {summary.pending}</span><span>Last successful sync: {summary.lastSuccessfulSync?new Date(summary.lastSuccessfulSync).toLocaleString():"Never"}</span></div>
    {summary.lastError&&<p className="settingsError">{summary.lastError}</p>}{error&&<p className="settingsError">{error}</p>}
    {!summary.connected?<div className="syncConnect"><button type="button" disabled={busy||Boolean(storageError)} onClick={start}>Start Sync</button><button type="button" disabled={busy||Boolean(storageError)} onClick={()=>setMode("join")}>Join Sync</button>{mode==="join"&&<div className="syncJoin"><label>Sync Key<input type="password" autoComplete="off" value={keyInput} onChange={event=>setKeyInput(event.target.value)} /></label>{hasSharedData(state)?<><p>This device already has local data. Choose how to continue.</p><button type="button" disabled={busy||!keyInput.trim()} onClick={()=>join("use-cloud")}>Use cloud data</button><button type="button" disabled={busy||!keyInput.trim()} onClick={()=>join("merge-local")}>Merge local data</button></>:<button type="button" disabled={busy||!keyInput.trim()} onClick={()=>join("use-cloud")}>Join</button>}<button type="button" onClick={()=>{setMode("idle");setKeyInput("")}}>Cancel</button></div>}</div>:<div className="syncActions"><button type="button" disabled={busy||summary.offline} onClick={()=>action(syncNow)}>Sync now</button><button type="button" onClick={reveal}>Show Sync Key</button><button type="button" onClick={showQr}>Show QR</button><button type="button" onClick={()=>action(async()=>{await removeThisDevice();setVisibleKey(undefined);setQr(undefined)})}>Remove this device</button></div>}
    {visibleKey&&<div className="syncKey"><code>{visibleKey}</code><button type="button" onClick={()=>navigator.clipboard.writeText(visibleKey)}>Copy Sync Key</button><button type="button" onClick={()=>{setVisibleKey(undefined);setQr(undefined)}}>Hide</button>{qr&&<img src={qr} alt="QR code containing the Sync Key"/>}</div>}
    {deleted.length>0&&<details><summary>Deleted tasks ({deleted.length})</summary>{deleted.map(task=><div className="syncDeleted" key={task.id}><span>{task.title}</span><button type="button" disabled={busy} onClick={()=>restore(task)}>Restore</button></div>)}</details>}
    <small>Sync runs only when you press Sync. The key stays in IndexedDB on this device and is never included in normal exports.</small>
  </fieldset>
}

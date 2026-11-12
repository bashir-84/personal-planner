"use client";

import Link from "next/link";
import {formatTracked} from "@/components/TaskTimer";
import {useEffect,useMemo,useRef,useState} from "react";
import {TaskEditDialog} from "@/components/TaskEditDialog";
import type {PlannerState,Task} from "@/domain/types";
import {emptyState,loadState,saveState,PERSONAL_KEY} from "@/storage/local";
import {commitIndexedPlanner,loadIndexedPlanner} from "@/storage/indexed";

const dateTime=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Tehran"});
const dateOnly=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{dateStyle:"medium",timeZone:"Asia/Tehran"});
function completionLabel(task:Task){
  const last=task.completionRecords?.at(-1)?.completedAt??task.completedAt;
  if(last&&!Number.isNaN(Date.parse(last)))return dateTime.format(new Date(last));
  return task.completedDay?dateOnly.format(new Date(`${task.completedDay}T12:00:00Z`)):"Time unknown";
}

export default function CompletedPage(){
  const[state,setState]=useState<PlannerState>(emptyState);
  const[storageKey,setStorageKey]=useState(PERSONAL_KEY);
  const[ready,setReady]=useState(false);
  const[storageError,setStorageError]=useState<string>();
  const persistedRef=useRef(emptyState);const writeQueue=useRef(Promise.resolve());
  const[editing,setEditing]=useState<string|null>(null);
  useEffect(()=>{let active=true;(async()=>{const requested=new URLSearchParams(window.location.search).get("storage");const key=requested?.startsWith("personal-planner-test-v2:")?requested:PERSONAL_KEY;setStorageKey(key);try{const loaded=key===PERSONAL_KEY?(await loadIndexedPlanner()).state:loadState(key);if(active){persistedRef.current=loaded;setState(loaded);setReady(true)}}catch(error){if(active){setStorageError(error instanceof Error?error.message:"IndexedDB is unavailable");const loaded=loadState(key);persistedRef.current=loaded;setState(loaded);setReady(true)}}})();return()=>{active=false}},[]);
  useEffect(()=>{if(!ready)return;if(storageKey!==PERSONAL_KEY){saveState(state,storageKey);return}const previous=persistedRef.current;if(previous===state)return;persistedRef.current=state;writeQueue.current=writeQueue.current.then(()=>commitIndexedPlanner(previous,state)).then(()=>undefined).catch(error=>setStorageError(error instanceof Error?error.message:"Could not save changes"))},[state,ready,storageKey]);
  const completed=useMemo(()=>state.tasks.filter(task=>task.completed).sort((a,b)=>{
    const aTime=Date.parse(a.completionRecords?.at(-1)?.completedAt??a.completedAt??"")||0;
    const bTime=Date.parse(b.completionRecords?.at(-1)?.completedAt??b.completedAt??"")||0;
    return bTime-aTime||a.id.localeCompare(b.id);
  }),[state.tasks]);
  const task=state.tasks.find(item=>item.id===editing);
  const update=(id:string,patch:Partial<Task>)=>setState(current=>({...current,revision:current.revision+1,tasks:current.tasks.map(item=>item.id===id?{...item,...patch}:item)}));
  const reopen=(id:string)=>setState(current=>({...current,revision:current.revision+1,tasks:current.tasks.map(item=>item.id===id?{...item,completed:false,completedAt:undefined,completedDay:undefined}:item),confirmed:current.confirmed.filter(item=>item.taskId!==id)}));
  return <main className="completedPage">{storageError&&<p className="settingsError" role="alert">{storageError}</p>}<header><Link href={storageKey===PERSONAL_KEY?"/":"/test"}>← Planner</Link><h1>Completed Tasks</h1><span>{completed.length}</span></header>{completed.length?<div className="completedList">{completed.map(item=>{
    const project=state.projects.find(project=>project.id===item.projectId);
    return <button className="completedItem" key={item.id} onClick={()=>setEditing(item.id)} style={{borderInlineStartColor:project?.color??"#8a968f"}}><strong>{item.title}{item.targetDay&&<small> · {dateOnly.format(new Date(`${item.targetDay}T12:00:00Z`))}</small>}</strong><span>{project?.name??"No project"} · {Math.floor(item.duration/60)}:{String(item.duration%60).padStart(2,"0")}</span><span>Tracked {formatTracked(item.trackedSeconds??0)}</span><span>{item.deadline?`Due ${dateTime.format(new Date(item.deadline))}`:"No deadline"}</span><time>{completionLabel(item)}</time></button>})}</div>:<p className="completedEmpty">No completed tasks yet.</p>}
    {task&&<TaskEditDialog task={task} projects={state.projects} onClose={()=>setEditing(null)} onChange={patch=>update(task.id,patch)} onToggle={complete=>{if(!complete)reopen(task.id);setEditing(null)}}/>}
  </main>;
}

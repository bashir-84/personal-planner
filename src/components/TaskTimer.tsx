"use client";
import {useEffect,useState} from "react";
import type {Task} from "@/domain/types";

export function elapsedSeconds(task:Task,now=Date.now()){return Math.max(0,Math.floor((task.trackedSeconds??0)+(task.timerStartedAt?Math.max(0,now-Date.parse(task.timerStartedAt))/1000:0)))}
export function formatTracked(seconds:number){return `${Math.floor(seconds/3600)}:${String(Math.floor(seconds/60)%60).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`}
export function stoppedTimer(task:Task,now=Date.now()):Partial<Task>{return {trackedSeconds:elapsedSeconds(task,now),timerStartedAt:undefined}}
export function TaskTimer({task,onChange}:{task:Task;onChange:(patch:Partial<Task>)=>void}){
 const[now,setNow]=useState(()=>Date.now());const[editing,setEditing]=useState(false);const[value,setValue]=useState("");const[error,setError]=useState(false);
 useEffect(()=>{if(!task.timerStartedAt)return;const id=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(id)},[task.timerStartedAt]);
 const seconds=elapsedSeconds(task,now);
 function save(){const parts=value.trim().split(":");if(!/^\d+$/.test(parts[0]??"")||parts.length<2||parts.length>3||parts.slice(1).some(part=>!/^\d{1,2}$/.test(part)||Number(part)>59)){setError(true);return}const total=parts.length===2?Number(parts[0])*3600+Number(parts[1])*60:Number(parts[0])*3600+Number(parts[1])*60+Number(parts[2]);if(!Number.isSafeInteger(total)){setError(true);return}onChange({trackedSeconds:total,timerStartedAt:task.timerStartedAt?new Date().toISOString():undefined});setError(false);setEditing(false)}
 return <span className="taskTimer" onClick={e=>e.stopPropagation()}>{!task.completed&&<button type="button" aria-label={`${task.timerStartedAt?"Stop":"Start"} timer for ${task.title}`} title={task.timerStartedAt?"Stop timer":"Start timer"} onClick={()=>{const timestamp=Date.now();setNow(timestamp);onChange(task.timerStartedAt?stoppedTimer(task,timestamp):{timerStartedAt:new Date(timestamp).toISOString()})}}>{task.timerStartedAt?"⏸":"◷"}</button>}{editing?<span><input aria-label={`Edit tracked time for ${task.title}`} autoFocus value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")save();if(e.key==="Escape")setEditing(false)}}/><button type="button" onClick={save}>Save</button><button type="button" onClick={()=>setEditing(false)}>Cancel</button>{error&&<small>Use hours:minutes:seconds</small>}</span>:<button type="button" aria-label={`Tracked time for ${task.title}: ${formatTracked(seconds)}; edit`} onClick={()=>{setValue(formatTracked(seconds));setEditing(true)}}>{formatTracked(seconds)}</button>}</span>
}

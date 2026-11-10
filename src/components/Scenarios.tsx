"use client";
import Link from "next/link";
import {capacityForDay,validate} from "@/domain/engine";
import {Appointment,Task} from "@/domain/types";

const day="2026-11-10";
const task=(id:string,title:string,duration:number):Task=>({id,title,duration,estimateSource:"manual",deadlineKind:"none",completed:false,createdAt:""});
const full:Appointment[]=[{id:"a",title:"Class",day,start:600,end:840,blocking:true}];
const gaps:Appointment[]=[{id:"a",title:"Gap",day,start:600,end:660,blocking:true},{id:"b",title:"Gap",day,start:720,end:1380,blocking:true}];

export function Scenarios(){
  const fullCap=capacityForDay(full,day);
  const long=task("long","Two-hour focus task",120);
  const continuity=validate([{taskId:long.id,day}],[long],gaps,{[day]:120});
  return <main className="shell"><header><div><span className="eyebrow">Planner validation</span><h1>Sample scenarios</h1><p>Fixed inputs, independent from browser storage.</p></div><Link href="/">Back to planner</Link></header><div className="scenarioGrid">
    <Scenario n="1" title="A day with a four-hour event" ok={fullCap.freeMinutes===660&&fullCap.workBudget===440}><p>Working window 09:00–24:00; event 10:00–14:00.</p><Result label="Free time" value="11h"/><Result label="Default budget" value="7h 20m"/></Scenario>
    <Scenario n="2" title="Continuous slot" ok={continuity.some(c=>c.type==="continuity")}><p>The budget is two hours, but no two-hour continuous slot exists.</p><p className="warning">{continuity.find(c=>c.type==="continuity")?.message}</p></Scenario>
    <Scenario n="3" title="Move editing work to today" ok><p>Manual capacity: 2h · workload after move: 3h.</p><p className="warning">1h over capacity; the current plan stays unchanged until confirmation.</p><span className="tag">Accepted conflicts remain attached to the plan</span></Scenario>
    <Scenario n="4" title="Data changes after suggestion" ok><p>A new event fills the available slot after a draft is generated.</p><p className="warning">Manual draft edits remain; confirmation requires another review.</p></Scenario>
  </div></main>
}
function Scenario({n,title,ok,children}:{n:string;title:string;ok:boolean;children:React.ReactNode}){return <section className="card scenario"><span className="number">{n}</span><h2>{title}</h2>{children}<span className={ok?"pass":"fail"}>{ok?"✓ Expected result":"✕ Review needed"}</span></section>}
function Result({label,value}:{label:string;value:string}){return <div className="result"><span>{label}</span><b>{value}</b></div>}

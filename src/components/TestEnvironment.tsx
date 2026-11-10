"use client";
import {useMemo,useRef,useState} from "react";
import Link from "next/link";
import {Planner} from "./Planner";
import {PlannerState,TestDataset} from "@/domain/types";
import sample from "../../data/planner-test-data.json";
import {clearState,emptyState} from "@/storage/local";

const dataset=sample as TestDataset;
const testKey=(id:string)=>`personal-planner-test-v1:${id}`;
function scenarioState(id:string):PlannerState{
  const scenario=dataset.scenarios.find(item=>item.id===id)??dataset.scenarios[0];
  return {...emptyState,projects:structuredClone(dataset.projects),tasks:structuredClone(dataset.tasks),appointments:structuredClone(scenario.appointments),confirmed:structuredClone(scenario.confirmed),manualBudgets:structuredClone(scenario.manualBudgets)};
}
export function TestEnvironment(){
  const[scenarioId,setScenarioId]=useState(dataset.scenarios[0].id);const[instance,setInstance]=useState(0);const latest=useRef<PlannerState>(scenarioState(scenarioId));
  const scenario=useMemo(()=>dataset.scenarios.find(item=>item.id===scenarioId)??dataset.scenarios[0],[scenarioId]);
  function changeScenario(id:string){setScenarioId(id);latest.current=scenarioState(id);setInstance(x=>x+1)}
  function reset(){clearState(testKey(scenarioId));latest.current=scenarioState(scenarioId);setInstance(x=>x+1)}
  function exportJson(){const state=latest.current;const output:TestDataset={...dataset,projects:state.projects,tasks:state.tasks,scenarios:dataset.scenarios.map(item=>item.id===scenarioId?{...item,appointments:state.appointments,manualBudgets:state.manualBudgets,confirmed:state.confirmed}:item)};const blob=new Blob([JSON.stringify(output,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="planner-test-data.json";link.click();URL.revokeObjectURL(url)}
  return <><aside className="testToolbar"><strong>محیط تست</strong><select aria-label="انتخاب سناریو" value={scenarioId} onChange={e=>changeScenario(e.target.value)}>{dataset.scenarios.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select><span>{scenario.expected}</span><button onClick={reset}>بازنشانی دادهٔ نمونه</button><button onClick={exportJson}>خروجی JSON</button><Link href="/">بازگشت به دادهٔ شخصی</Link></aside><Planner key={`${scenarioId}-${instance}`} storageKey={testKey(scenarioId)} initialState={scenarioState(scenarioId)} referenceDate={dataset.referenceDate} testMode onStateChange={state=>{latest.current=state}}/></>
}

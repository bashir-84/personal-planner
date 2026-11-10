import {PlannerState} from "@/domain/types";
export const PERSONAL_KEY="personal-planner-v0.1";
export const emptyState:PlannerState={revision:0,projects:[],tasks:[],notes:[],appointments:[],confirmed:[],manualBudgets:{}};
export function loadState(key=PERSONAL_KEY,fallback:PlannerState=emptyState):PlannerState{if(typeof window==="undefined")return fallback;try{const saved=localStorage.getItem(key);return saved?{...fallback,...JSON.parse(saved)}:fallback}catch{return fallback}}
export function saveState(state:PlannerState,key=PERSONAL_KEY){localStorage.setItem(key,JSON.stringify(state));}
export function clearState(key=PERSONAL_KEY){localStorage.removeItem(key)}

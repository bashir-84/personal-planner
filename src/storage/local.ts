import {PlannerState} from "@/domain/types";
const KEY="personal-planner-v0.1";
export const emptyState:PlannerState={revision:0,projects:[],tasks:[],notes:[],appointments:[],confirmed:[],manualBudgets:{}};
export function loadState():PlannerState{if(typeof window==="undefined")return emptyState;try{return{...emptyState,...JSON.parse(localStorage.getItem(KEY)??"")}}catch{return emptyState}}
export function saveState(state:PlannerState){localStorage.setItem(KEY,JSON.stringify(state));}
export function clearState(){localStorage.removeItem(KEY)}

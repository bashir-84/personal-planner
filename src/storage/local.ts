import {PlannerState} from "@/domain/types";
import {DEFAULT_SETTINGS,normalizeSettings} from "../domain/settings";
export const PERSONAL_KEY="personal-planner-v0.1";
export const emptyState:PlannerState={revision:0,projects:[],tasks:[],notes:[],appointments:[],confirmed:[],manualBudgets:{},settings:DEFAULT_SETTINGS};
export function loadState(key=PERSONAL_KEY,fallback:PlannerState=emptyState):PlannerState{if(typeof window==="undefined")return{...fallback,settings:normalizeSettings(fallback.settings)};try{const saved=localStorage.getItem(key);const value=saved?{...fallback,...JSON.parse(saved)}:fallback;return{...value,settings:normalizeSettings(value.settings)}}catch{return{...fallback,settings:normalizeSettings(fallback.settings)}}}
export function saveState(state:PlannerState,key=PERSONAL_KEY){localStorage.setItem(key,JSON.stringify(state));}
export function clearState(key=PERSONAL_KEY){localStorage.removeItem(key)}

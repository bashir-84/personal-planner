export type PlannerLog={id:string;at:string;level:"info"|"error";area:"sync"|"google"|"storage"|"planner";message:string;details?:string};
const KEY="personal-planner-debug-logs-v1",LIMIT=300;
export function readLogs(){try{return JSON.parse(localStorage.getItem(KEY)??"[]") as PlannerLog[]}catch{return[]}}
export function writeLog(area:PlannerLog["area"],message:string,level:PlannerLog["level"]="info",details?:string){
  try {
    if(typeof window==="undefined")return;
    const next=[{id:crypto.randomUUID(),at:new Date().toISOString(),area,message,level,details},...readLogs()].slice(0,LIMIT);
    localStorage.setItem(KEY,JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("planner-debug-log"));
  } catch {
    // Diagnostics must never interrupt a planner action or retry.
  }
}
export function clearLogs(){localStorage.removeItem(KEY);window.dispatchEvent(new CustomEvent("planner-debug-log"))}

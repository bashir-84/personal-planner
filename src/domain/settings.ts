import type {DeadlineKind,PlannerSettings} from "./types";

export const SETTINGS_VERSION=1;
export const DEFAULT_SETTINGS:PlannerSettings={
  version:SETTINGS_VERSION,
  general:{
    workStart:9*60,
    workEnd:24*60,
    workRatio:2/3,
    activeWeekdays:[0,1,2,3,4,5,6],
    defaultTaskDuration:30,
    defaultDeadlineKind:"none",
    defaultDeadlineTime:"12:00",
    defaultImportance:3,
    defaultUrgency:2,
    weekStartsOn:6,
    timeZone:"Asia/Tehran",
    calendar:"persian",
  },
  advanced:{
    planningHorizonDays:7,
    preserveManualLayout:true,
    showReasons:true,
    showComparison:true,
    recurrenceHorizonDays:7,
    manualCapacityMode:"remaining-work-budget",
  },
};

const finite=(value:unknown,fallback:number,min:number,max:number)=>typeof value==="number"&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
const deadlineKinds:DeadlineKind[]=["none","hard","flexible"];

export function normalizeSettings(value?:Partial<PlannerSettings>):PlannerSettings{
  const general=value?.general??{} as Partial<PlannerSettings["general"]>;
  const advanced=value?.advanced??{} as Partial<PlannerSettings["advanced"]>;
  const active=Array.isArray(general.activeWeekdays)?[...new Set(general.activeWeekdays.filter(day=>Number.isInteger(day)&&day>=0&&day<=6))]:DEFAULT_SETTINGS.general.activeWeekdays;
  return {
    version:SETTINGS_VERSION,
    general:{
      workStart:finite(general.workStart,DEFAULT_SETTINGS.general.workStart,0,1439),
      workEnd:finite(general.workEnd,DEFAULT_SETTINGS.general.workEnd,1,1440),
      workRatio:finite(general.workRatio,DEFAULT_SETTINGS.general.workRatio,0,1),
      activeWeekdays:active,
      defaultTaskDuration:finite(general.defaultTaskDuration,DEFAULT_SETTINGS.general.defaultTaskDuration,1,1440),
      defaultDeadlineKind:deadlineKinds.includes(general.defaultDeadlineKind as DeadlineKind)?general.defaultDeadlineKind as DeadlineKind:DEFAULT_SETTINGS.general.defaultDeadlineKind,
      defaultDeadlineTime:/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(general.defaultDeadlineTime??"")?general.defaultDeadlineTime!:DEFAULT_SETTINGS.general.defaultDeadlineTime,
      defaultImportance:finite(general.defaultImportance,DEFAULT_SETTINGS.general.defaultImportance,1,5),
      defaultUrgency:finite(general.defaultUrgency,DEFAULT_SETTINGS.general.defaultUrgency,1,5),
      weekStartsOn:Number.isInteger(general.weekStartsOn)&&general.weekStartsOn!>=0&&general.weekStartsOn!<=6?general.weekStartsOn!:DEFAULT_SETTINGS.general.weekStartsOn,
      timeZone:"Asia/Tehran",
      calendar:"persian",
    },
    advanced:{
      planningHorizonDays:finite(advanced.planningHorizonDays,DEFAULT_SETTINGS.advanced.planningHorizonDays,1,30),
      preserveManualLayout:advanced.preserveManualLayout??DEFAULT_SETTINGS.advanced.preserveManualLayout,
      showReasons:advanced.showReasons??DEFAULT_SETTINGS.advanced.showReasons,
      showComparison:advanced.showComparison??DEFAULT_SETTINGS.advanced.showComparison,
      recurrenceHorizonDays:finite(advanced.recurrenceHorizonDays,DEFAULT_SETTINGS.advanced.recurrenceHorizonDays,1,90),
      manualCapacityMode:"remaining-work-budget",
    },
  };
}

export function isActiveWorkday(day:string,settings:PlannerSettings){return settings.general.activeWeekdays.includes(new Date(`${day}T12:00:00Z`).getUTCDay())}
export function clockValue(minutes:number){return minutes===1440?"24:00":`${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`}
export function parseClock(value:string){if(value==="24:00")return 1440;const match=value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);return match?Number(match[1])*60+Number(match[2]):NaN}

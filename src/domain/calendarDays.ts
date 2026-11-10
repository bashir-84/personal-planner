import { tehranReferenceTime } from "./referenceTime";

const DAY=86400000;
/** Calendar-day arithmetic uses Tehran dates, so DST/UTC clock hours never shift a day count. */
export function dayNumber(day:string):number{
  const [year,month,date]=day.split("-").map(Number);
  return Math.floor(Date.UTC(year,month-1,date)/DAY);
}
export function dayOffset(day:string,offset:number):string{
  return new Date((dayNumber(day)+offset)*DAY).toISOString().slice(0,10);
}
export function deadlineDayOffset(deadline:string,referenceDay:string):number{
  return dayNumber(tehranReferenceTime(new Date(deadline)).day)-dayNumber(referenceDay);
}

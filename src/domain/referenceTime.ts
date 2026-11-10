/** A single explicit clock value, expressed as a Tehran calendar day and minute. */
export type ReferenceTime = { day: string; minute: number };

export function tehranReferenceTime(instant: Date): ReferenceTime {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(instant);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Start of the remaining working opportunity on a calendar day. */
export function remainingStart(day: string, reference: ReferenceTime): number {
  if (day < reference.day) return 1440;
  if (day > reference.day) return 540;
  return Math.max(540, Math.min(1440, reference.minute));
}

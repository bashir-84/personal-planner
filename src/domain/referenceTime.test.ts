import { describe, expect, it } from "vitest";
import { remainingStart, tehranReferenceTime } from "./referenceTime";

describe("Tehran reference time", () => {
  it("uses Tehran's calendar day when UTC is on the previous day", () => {
    expect(tehranReferenceTime(new Date("2026-11-10T21:00:00Z"))).toEqual({ day: "2026-11-11", minute: 30 });
  });
  it("clips past days, early mornings and the end of the day", () => {
    const reference = { day: "2026-11-11", minute: 18 * 60 };
    expect(remainingStart("2026-11-10", reference)).toBe(1440);
    expect(remainingStart("2026-11-11", reference)).toBe(1080);
    expect(remainingStart("2026-11-12", reference)).toBe(540);
    expect(remainingStart(reference.day, { ...reference, minute: 30 })).toBe(540);
    expect(remainingStart(reference.day, { ...reference, minute: 1500 })).toBe(1440);
  });
  it("changes the remaining day at Tehran midnight without using the UTC date",()=>{
    const before=tehranReferenceTime(new Date("2026-11-10T20:29:00Z"));
    const after=tehranReferenceTime(new Date("2026-11-10T20:30:00Z"));
    expect(before).toEqual({day:"2026-11-10",minute:1439});
    expect(after).toEqual({day:"2026-11-11",minute:0});
    expect(remainingStart(before.day,after)).toBe(1440);
    expect(remainingStart(after.day,after)).toBe(540);
  });
});

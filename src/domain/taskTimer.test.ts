import {describe,it,expect} from "vitest";
import {elapsedSeconds,formatTracked,stoppedTimer} from "../components/TaskTimer";
import type {Task} from "./types";
const task:Task={id:"a",title:"Task",duration:30,estimateSource:"default",deadlineKind:"none",completed:false,createdAt:"2026-01-01T00:00:00Z"};
describe("tracked time",()=>{
 it("accumulates elapsed time and freezes it on completion",()=>{const running={...task,trackedSeconds:75,timerStartedAt:"2026-01-01T00:00:00Z"};const now=Date.parse("2026-01-01T00:01:05Z");expect(elapsedSeconds(running,now)).toBe(140);expect(stoppedTimer(running,now)).toEqual({trackedSeconds:140,timerStartedAt:undefined});expect(formatTracked(140)).toBe("0:02:20")});
 it("never subtracts time when the clock goes backwards",()=>{expect(elapsedSeconds({...task,trackedSeconds:20,timerStartedAt:"2026-01-01T00:00:00Z"},Date.parse("2025-12-31T23:59:00Z"))).toBe(20)});
});

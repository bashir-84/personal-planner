import {describe,expect,it} from "vitest";
import worker from "../../worker/src/index";

describe("sync Worker HTTP contract",()=>{
  it("preserves health and emits CORS only for approved origins",async()=>{const response=await worker.fetch(new Request("https://worker.test/health",{headers:{origin:"https://bashiramri.ir"}}),{} as never);expect(response.status).toBe(200);expect(response.headers.get("access-control-allow-origin")).toBe("https://bashiramri.ir");expect(await response.json()).toMatchObject({service:"personal-planner-sync",status:"ready"})});
  it("rejects unapproved origins",async()=>{const response=await worker.fetch(new Request("https://worker.test/health",{headers:{origin:"https://evil.example"}}),{} as never);expect(response.status).toBe(403);expect(await response.json()).toMatchObject({ok:false,error:{code:"ORIGIN_NOT_ALLOWED"}})});
  it("requires a bearer Sync Key without exposing it",async()=>{const response=await worker.fetch(new Request("https://worker.test/v1/sync",{method:"POST",headers:{origin:"http://localhost:3000","content-type":"application/json"},body:"{}"}),{} as never);expect(response.status).toBe(401);expect(await response.json()).toMatchObject({ok:false,error:{code:"UNAUTHORIZED"}})});
});

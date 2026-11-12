import {test,expect,type Page} from "@playwright/test";

const key="sync-key-abcdefghijklmnopqrstuvwxyz-0123456789";
const cloudTask={id:"cloud-task",title:"Cloud task",duration:45,estimateSource:"manual",deadlineKind:"none",completed:false,createdAt:"2026-01-01T00:00:00.000Z"};
const versions=Object.fromEntries(["__deleted",...Object.keys(cloudTask).filter(field=>field!=="id")].map(field=>[field,{clientUpdatedAt:"2026-01-01T10:00:00.000Z",operationId:"cloud-create"}]));
const cloudChange={entityType:"task",entityId:cloudTask.id,patch:{__deleted:false,...Object.fromEntries(Object.entries(cloudTask).filter(([field])=>field!=="id"))},versions,sequence:1};

async function mockSync(page:Page,{cloud=false}:{cloud?:boolean}={}){const calls:{url:string;authorization:string|null;body:{cursor:number;deviceId:string;operations:{operationId:string}[]}}[]=[];await page.route("**/v1/sync",async route=>{const request=route.request();const body=request.postDataJSON();calls.push({url:request.url(),authorization:await request.headerValue("authorization"),body});await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,nextCursor:cloud?1:calls.length,appliedOperationIds:body.operations.map((item:{operationId:string})=>item.operationId),ignoredOperationIds:[],changes:cloud?[cloudChange]:[],serverTime:"2026-01-01T12:00:00.000Z"})})});return calls}
async function openSync(page:Page){await page.getByRole("button",{name:"Open menu"}).click();await page.getByRole("button",{name:"Settings"}).click();const dialog=page.getByRole("dialog",{name:"Settings"});await dialog.getByRole("tab",{name:"Advanced"}).click();return dialog}
async function addTask(page:Page,title:string){await page.getByLabel("Task title").fill(title);await page.getByRole("button",{name:"Add task details"}).click();await page.getByRole("dialog",{name:"New task"}).getByRole("button",{name:"Confirm"}).click()}

test("localStorage migrates and mutations stay pending until manual Sync",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("personal-planner-v0.1",JSON.stringify({revision:0,projects:[],tasks:[{id:"legacy",title:"Legacy task",duration:30,estimateSource:"default",deadlineKind:"none",completed:false,createdAt:""}],notes:[],appointments:[],confirmed:[],manualBudgets:{}})));
  const calls=await mockSync(page);await page.goto(".");await expect(page.getByRole("button",{name:"Legacy task"})).toBeVisible();const settings=await openSync(page);await settings.getByRole("button",{name:"Start Sync"}).click();await expect.poll(()=>calls.length).toBe(1);await settings.getByRole("button",{name:"Cancel"}).click();await addTask(page,"Offline task");await page.waitForTimeout(300);expect(calls).toHaveLength(1);const syncButton=page.getByRole("button",{name:/Sync · Pending/});await expect(syncButton).toBeEnabled();await syncButton.click();await expect.poll(()=>calls.length).toBe(2);expect(calls[1].body.operations.length).toBeGreaterThan(0);expect(calls[1].authorization).toMatch(/^Bearer /);expect(calls[1].url).not.toContain("sync-key");
});

test("Join requires an explicit Use cloud data choice when local data exists",async({page})=>{
  await mockSync(page,{cloud:true});await page.goto(".");await addTask(page,"Local only");const settings=await openSync(page);await settings.getByRole("button",{name:"Join Sync"}).click();await settings.getByLabel("Sync Key").fill(key);await settings.getByRole("button",{name:"Use cloud data"}).click();await expect(settings.getByText("Synced")).toBeVisible();await settings.getByRole("button",{name:"Cancel"}).click();await expect(page.getByRole("button",{name:"Cloud task"})).toBeVisible();await expect(page.getByRole("button",{name:"Local only"})).toHaveCount(0);
});

test("Join can merge local and cloud entities without silent overwrite",async({page})=>{
  const calls=await mockSync(page,{cloud:true});await page.goto(".");await addTask(page,"Local merge");const settings=await openSync(page);await settings.getByRole("button",{name:"Join Sync"}).click();await settings.getByLabel("Sync Key").fill(key);await settings.getByRole("button",{name:"Merge local data"}).click();await expect.poll(()=>calls.length).toBeGreaterThanOrEqual(2);await settings.getByRole("button",{name:"Cancel"}).click();await expect(page.getByRole("button",{name:"Cloud task"})).toBeVisible();await expect(page.getByRole("button",{name:"Local merge"})).toBeVisible();
});

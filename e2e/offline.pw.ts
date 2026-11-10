import {test,expect} from "@playwright/test";

test.skip(!process.env.PLANNER_OFFLINE_TEST,"Run against the production static export");

test("static pages refresh offline and personal edits persist",async({page,context})=>{
  await page.goto("./");
  const cdp=await context.newCDPSession(page);
  const manifest=await cdp.send("Page.getAppManifest");
  expect(manifest.errors).toEqual([]);
  expect(JSON.parse(manifest.data??"{}").start_url).toBe("/personal-planner/");
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;await new Promise<void>(resolve=>{if(navigator.serviceWorker.controller)return resolve();navigator.serviceWorker.addEventListener("controllerchange",()=>resolve(),{once:true})})});
  for(const route of ["test/","scenarios/","import/","completed/","./"]){
    await page.goto(route);
    await expect(page.locator("body")).toBeVisible();
  }
  await context.setOffline(true);
  for(const route of ["test/","scenarios/","import/","completed/","./"]){
    await page.goto(route);
    await page.reload();
    await expect(page.locator("body")).toBeVisible();
  }
  await page.getByRole("textbox",{name:"Task title"}).fill("Offline review");
  await page.getByRole("button",{name:"Add task details"}).click();
  await page.getByRole("dialog",{name:"New task"}).getByRole("button",{name:"Confirm"}).click();
  await expect(page.getByRole("button",{name:"Offline review",exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button",{name:"Offline review",exact:true})).toBeVisible();
});

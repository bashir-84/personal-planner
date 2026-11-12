import {test,expect} from "@playwright/test";

test("settings save, persist, reset safely and fit mobile",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(".");
  await page.getByRole("button",{name:"Open menu"}).click();
  await page.getByRole("button",{name:"Settings"}).click();
  const dialog=page.getByRole("dialog",{name:"Settings"});
  await expect(dialog).toBeVisible();
  const box=await dialog.boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x??0)+(box?.width??0)).toBeLessThanOrEqual(390);
  await dialog.getByLabel("Start",{exact:true}).fill("10:00");
  await dialog.getByLabel("End",{exact:true}).fill("18:00");
  await dialog.getByLabel("Free time for tasks").fill("50");
  await dialog.getByRole("button",{name:"Save"}).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await page.getByRole("button",{name:"Open menu"}).click();
  await page.getByRole("button",{name:"Settings"}).click();
  await expect(dialog.getByLabel("Start",{exact:true})).toHaveValue("10:00");
  await expect(dialog.getByLabel("End",{exact:true})).toHaveValue("18:00");
  await dialog.getByRole("button",{name:"Reset General"}).click();
  await dialog.getByRole("button",{name:"Save"}).click();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("personal-planner-v0.1")??"{}"));
  expect(stored.settings.general.workStart).toBe(540);
  expect(stored.settings.general.workEnd).toBe(1440);
  expect(stored.tasks).toEqual([]);
});

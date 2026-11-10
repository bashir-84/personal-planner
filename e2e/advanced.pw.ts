import {test,expect} from "@playwright/test";

test("relative deadline and ordered stages use the shared editor",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("./");
  await page.getByRole("textbox",{name:"Task title"}).fill("Staged review");
  await page.getByRole("button",{name:"Add task details"}).click();
  const dialog=page.getByRole("dialog",{name:"New task"});
  await dialog.getByLabel("Days from today").fill("4");
  await expect(dialog.getByLabel("Deadline Persian date")).not.toBeEmpty();
  await dialog.getByLabel("Deadline Persian date").fill("۱۴۰۵/۱۲/۲۹");
  const yearEnd=Number(await dialog.getByLabel("Days from today").inputValue());
  await dialog.getByLabel("Deadline Persian date").fill("۱۴۰۶/۰۱/۰۱");
  expect(Number(await dialog.getByLabel("Days from today").inputValue())).toBe(yearEnd+1);
  await dialog.getByLabel("Deadline Persian date").fill("۱۴۰۶/۱۳/۰۱");
  await expect(dialog.getByRole("button",{name:"Confirm"})).toBeDisabled();
  await dialog.getByLabel("Days from today").fill("4");
  await dialog.locator(".taskAdvanced summary").click();
  await dialog.getByRole("button",{name:"+ Add stage"}).click();
  await dialog.getByLabel("Stage 1 title").fill("Read");
  await dialog.getByLabel("Stage 1 minutes").fill("60");
  await dialog.getByRole("button",{name:"+ Add stage"}).click();
  await dialog.getByLabel("Stage 2 title").fill("Write");
  await dialog.getByLabel("Stage 2 minutes").fill("90");
  expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
  await dialog.getByRole("button",{name:"Confirm"}).click();
  await page.getByRole("button",{name:"Plan tasks"}).click();
  await expect(page.locator(".draftRow").filter({hasText:"Staged review"})).toHaveCount(2);
  await expect(page.locator(".draftRow").filter({hasText:"01 Read"})).toBeVisible();
  await expect(page.locator(".draftRow").filter({hasText:"02 Write"})).toBeVisible();
  await page.getByRole("button",{name:"Confirm",exact:true}).click();
  await page.getByRole("checkbox",{name:"Complete Staged review · 01 Read"}).check();
  await expect(page.locator(".openTasksCard")).toContainText("Staged review");
  await page.getByRole("checkbox",{name:"Complete Staged review · 02 Write"}).check();
  await page.getByRole("button",{name:"Open menu"}).click();
  await page.getByRole("link",{name:"Completed Tasks"}).click();
  await expect(page.locator(".completedItem")).toContainText("Staged review");
});

test("daily recurrence creates editable instances without duplicating them on refresh",async({page})=>{
  await page.goto("./");
  await page.getByRole("textbox",{name:"Task title"}).fill("Daily practice");
  await page.getByRole("button",{name:"Add task details"}).click();
  const dialog=page.getByRole("dialog",{name:"New task"});
  await dialog.locator(".taskAdvanced summary").click();
  await dialog.getByLabel("Repeat frequency").selectOption("daily");
  await dialog.getByRole("button",{name:"Confirm"}).click();
  const instanceCount=()=>page.evaluate(()=>JSON.parse(localStorage.getItem("personal-planner-v0.1")??"{}").tasks?.filter((task:{recurrenceSourceId?:string})=>task.recurrenceSourceId).length??0);
  await expect.poll(instanceCount).toBe(7);
  await page.reload();
  await expect.poll(instanceCount).toBe(7);
});

test("completed history in a test scenario stays separate from personal history",async({page})=>{
  await page.goto("test/");
  const row=page.locator(".openTasksCard .taskListRow").first();
  const title=(await row.locator(".taskTitle").innerText()).trim();
  await row.getByRole("checkbox").click();
  await page.getByRole("button",{name:"Open menu"}).click();
  await page.getByRole("link",{name:"Completed Tasks"}).click();
  await expect(page.locator(".completedItem").filter({hasText:title})).toBeVisible();
  await page.goto("./");
  await page.getByRole("button",{name:"Open menu"}).click();
  await page.getByRole("link",{name:"Completed Tasks"}).click();
  await expect(page.locator(".completedItem")).toHaveCount(0);
});

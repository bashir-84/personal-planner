import {expect, test} from "@playwright/test";

test("schedule an open task today and move it to tomorrow", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.clock.setFixedTime(new Date("2026-11-26T07:00:00Z"));
  await page.goto("./");
  await page.getByLabel("Task title").fill("Shortcut test");
  await page.getByLabel("Add task details").click();
  await page.getByRole("dialog",{name:"New task"}).getByRole("button",{name:"Confirm"}).click();
  const open = page.locator(".openTasksCard .taskListRow").filter({hasText:"Shortcut test"});
  const confirmed = page.locator(".confirmedRow").filter({hasText:"Shortcut test"});
  const draft = page.getByRole("dialog",{name:"Plan"});
  await open.getByRole("button",{name:"Today",exact:true}).click();
  await expect(draft.locator(".draftRow select")).toHaveValue("2026-11-26");
  await draft.getByRole("button",{name:"Confirm",exact:true}).click();
  await expect(confirmed).toHaveCount(1);
  await confirmed.getByRole("button",{name:"Tomorrow",exact:true}).click();
  await expect(draft.locator(".draftRow select")).toHaveValue("2026-11-27");
  await draft.getByRole("button",{name:/^Confirm/}).click();
  await expect(confirmed).toHaveCount(0);
  await page.reload();
  await page.getByRole("button",{name:"Next day",exact:true}).click();
  await expect(confirmed).toHaveCount(1);
  await expect(open).toHaveCount(1);
});

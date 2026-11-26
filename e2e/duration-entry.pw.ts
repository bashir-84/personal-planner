import {expect, test} from "@playwright/test";

test("duration input preserves digits until leaving the field group", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto("./");
  await page.getByLabel("Task title").fill("Duration entry");
  await page.getByLabel("Add task details").click();
  const dialog = page.getByRole("dialog",{name:"New task"});
  const minutes = dialog.getByLabel("Duration minutes");
  await minutes.fill("");
  await expect(minutes).toHaveValue("");
  await minutes.pressSequentially("0");
  await expect(minutes).toHaveValue("0");
  await expect(dialog.getByRole("alert")).toContainText("at least one minute");
  await minutes.pressSequentially("5");
  await expect(minutes).toHaveValue("05");
  await minutes.fill("۹۰");
  await expect(minutes).toHaveValue("۹۰");
  await dialog.getByRole("button",{name:"Confirm"}).click();
  await expect(page.locator(".openTasksCard .taskSignals")).toContainText("1:30");
});

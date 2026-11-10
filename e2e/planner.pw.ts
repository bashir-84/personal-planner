import {test, expect} from "@playwright/test";

test("task editing, completion undo, persistence and keyboard dialog behavior", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto("./");
  await page.getByRole("textbox",{name:"عنوان کار جدید"}).fill("UX review");
  await page.getByRole("button",{name:"Add task",exact:true}).click();
  const task = page.getByRole("button",{name:"UX review",exact:true});
  await task.click();
  const dialog = page.getByRole("dialog",{name:"Edit task"});
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("مدت (دقیقه)").fill("90");
  // Tab and Shift+Tab remain inside the modal.
  for(let i=0;i<12;i++) await page.keyboard.press("Tab");
  expect(await page.evaluate(()=>Boolean(document.activeElement?.closest("dialog")))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(task).toBeFocused();
  await expect(page.locator(".taskSignals")).toContainText("1:30");
  await page.getByRole("checkbox",{name:"انجام شد: UX review"}).check();
  await expect(page.locator(".taskListRow.isCompleted")).toContainText("UX review");
  await page.getByRole("button",{name:/Undo/}).click();
  await expect(page.getByRole("checkbox",{name:"انجام شد: UX review"})).not.toBeChecked();
  await page.reload();
  await expect(task).toBeVisible();
  await expect(page.locator(".taskSignals")).toContainText("1:30");
});

test("selected date is reversible and planning rechecks reselected days", async ({page}) => {
  await page.goto("test/");
  const date = page.locator(".datePicker summary");
  const original = await date.innerText();
  await page.getByRole("button",{name:"روز بعد",exact:true}).click();
  await expect(date).not.toHaveText(original);
  await page.getByRole("button",{name:"روز قبل",exact:true}).click();
  await expect(date).toHaveText(original);
  await page.getByRole("button",{name:"Plan",exact:true}).click();
  const day = page.locator(".planningDays button").first();
  const firstValue = await page.locator(".draftRow select").first().inputValue();
  await day.click();
  await expect(day).toHaveAttribute("aria-pressed","false");
  expect(await page.locator(".draftRow select").first().inputValue()).not.toBe(firstValue);
  await day.click();
  await expect(day).toHaveAttribute("aria-pressed","true");
  await expect(page.locator(".draftRow select").first()).toHaveValue(firstValue);
  await page.getByRole("button",{name:"Confirm",exact:true}).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".confirmedRow").first()).toBeVisible();
});

for(const width of [320,390,768,1440]) {
  test(`layout and editing fit ${width}px`,async({page})=>{
    const errors:string[]=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.setViewportSize({width,height:900});
    await page.goto("test/");
    await expect(page.locator(".taskListRow").first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator(".taskTitle").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await page.locator(".draft").evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await page.getByRole("button",{name:"Plan",exact:true}).click();
    expect(await page.locator(".draft").evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await expect(page.locator(".draftActions button")).toBeInViewport();
    expect(errors).toEqual([]);
  });
}

test("capacity and continuity warnings remain distinct and test data stays isolated", async ({page}) => {
  await page.goto("test/");
  await page.getByRole("combobox",{name:"انتخاب سناریو"}).selectOption("over-capacity");
  await expect(page.locator(".workload.over h2")).toHaveText("3:30 / 2:00");
  await expect(page.locator(".loadWarning").first()).toContainText("1:30");
  await page.getByRole("combobox",{name:"انتخاب سناریو"}).selectOption("fragmented-day");
  await expect(page.locator(".workload h2")).toHaveText("2:00 / 2:00");
  await expect(page.locator(".workload")).toContainText("No slot");
  await page.getByRole("link",{name:"بازگشت به دادهٔ شخصی"}).click();
  await expect(page.locator(".taskListRow")).toHaveCount(0);
});

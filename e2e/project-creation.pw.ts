import {test, expect} from "@playwright/test";

test("create, persist, edit and assign a project", async ({page}) => {
  await page.goto("./");
  await page.locator(".utilityProjects > summary").click();
  await page.getByPlaceholder("Project name").fill("Project review");
  await page.getByLabel("Add project").click();
  await expect(page.getByText("Project review", {exact: true})).toBeVisible();
  await page.reload();
  await page.locator(".utilityProjects > summary").click();
  await page.getByLabel("Edit Project review").click();
  const edit = page.getByRole("dialog", {name: "Edit project"});
  await edit.getByLabel("Project name").fill("Project renamed");
  await edit.getByRole("button", {name: "Save"}).click();
  await page.getByLabel("Task title").fill("Project task");
  await page.getByLabel("Add task details").click();
  const task = page.getByRole("dialog", {name: "New task"});
  await task.locator(".taskProjectField select").selectOption({label: "Project renamed"});
  await task.getByRole("button", {name: "Confirm"}).click();
  await page.getByRole("button", {name: "Project task", exact: true}).click();
  await expect(page.getByRole("dialog", {name: "Edit task"}).locator(".taskProjectField select")).toHaveValue(/.+/);
});

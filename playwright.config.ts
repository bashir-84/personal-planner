import {defineConfig} from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  use: {
    baseURL: process.env.PLANNER_TEST_URL ?? "http://localhost:3100/personal-planner/",
    launchOptions: process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {},
  },
  webServer: process.env.PLANNER_TEST_URL ? undefined : {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100/personal-planner/",
    reuseExistingServer: !process.env.CI,
  },
});

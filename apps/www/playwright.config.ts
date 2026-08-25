import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  expect: {
    timeout: 5000,
  },
  failOnFlakyTests: Boolean(process.env.CI),
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: "../../.cache/playwright/www",
  reporter: "list",
  retries: process.env.CI ? 1 : 0,
  testDir: "./e2e",
  testMatch: "**/*.browser.ts",
  timeout: 120_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  workers: process.env.CI ? 1 : undefined,
});

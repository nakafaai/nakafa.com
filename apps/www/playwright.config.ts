import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3101",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm exec next dev -p 3101",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: "http://localhost:3101/en/playwright/forum-conversation",
  },
  workers: 1,
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "mock",
      testMatch: /\.spec\.ts$/,
      testIgnore: /smoke\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "live",
      testMatch: /smoke\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  // webServer managed separately
});

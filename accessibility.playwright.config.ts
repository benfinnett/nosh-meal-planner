import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: /accessibility.*\.spec\.ts/,
  timeout: 60_000,
  outputDir: "test-results/accessibility",
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "playwright-report/accessibility", open: "never" },
    ],
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: "small-mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 320, height: 700 },
      },
    },
  ],
});

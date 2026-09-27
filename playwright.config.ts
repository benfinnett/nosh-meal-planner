import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5184", trace: "retain-on-failure" },
  projects: [
    {
      name: "laptop",
      use: {
        ...devices["Desktop Chrome"],
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
  webServer: [
    {
      command:
        "node --conditions=development --import ./apps/api/node_modules/tsx/dist/loader.mjs apps/api/src/server.ts",
      url: "http://127.0.0.1:3004/api/health/ready",
      env: { PORT: "3004", DATABASE_PATH: ":memory:", NODE_ENV: "test" },
      reuseExistingServer: false,
    },
    {
      command:
        "node apps/web/node_modules/vite/bin/vite.js --config apps/web/vite.config.ts apps/web --port 5184 --host 127.0.0.1",
      url: "http://127.0.0.1:5184",
      env: { API_PROXY_TARGET: "http://127.0.0.1:3004" },
      reuseExistingServer: false,
    },
  ],
});

import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

export default defineConfig({
  ...config,
  testMatch: "planner.spec.ts",
  workers: 1,
  use: { ...config.use, baseURL: "http://127.0.0.1:5184" },
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
        "node apps/web/node_modules/vite/bin/vite.js --config apps/web/vite.config.ts apps/web --port 5184",
      url: "http://127.0.0.1:5184",
      env: { API_PROXY_TARGET: "http://127.0.0.1:3004" },
      reuseExistingServer: false,
    },
  ],
});

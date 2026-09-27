import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "apps/web/src",
      ),
    },
    conditions: ["development"],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "domain",
          include: ["packages/meal-planning/src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "api",
          include: ["apps/api/src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "web",
          include: ["apps/web/src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
        },
      },
    ],
  },
});

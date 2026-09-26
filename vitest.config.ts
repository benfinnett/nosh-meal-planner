import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { conditions: ["development"] },
  test: {
    projects: [
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

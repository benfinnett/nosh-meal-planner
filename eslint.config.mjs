import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import a11y from "eslint-plugin-jsx-a11y";
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/.pnpm-store/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["apps/api/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: ["@nosh/web", "**/web/src/**", "react", "react-dom"] },
      ],
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks, "jsx-a11y": a11y },
    rules: {
      ...hooks.configs.recommended.rules,
      ...a11y.configs.recommended.rules,
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}", "packages/contracts/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "**/apps/api/**",
            "**/api/src/**",
            "@nosh/api",
            "better-sqlite3",
            "drizzle-orm",
            "drizzle-orm/*",
          ],
        },
      ],
    },
  },
  {
    files: ["packages/contracts/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "**/apps/**",
            "@nosh/web",
            "@nosh/api",
            "react",
            "fastify",
            "better-sqlite3",
            "drizzle-orm",
            "drizzle-orm/*",
          ],
        },
      ],
    },
  },
);

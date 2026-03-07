import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    sequence: {
      concurrent: false,
    },
    globalSetup: ["src/__tests__/integration/helpers/global-setup.ts"],
  },
});

import { defineConfig } from "vitest/config";

const testDbUrl = process.env.TEST_DATABASE_URL;

export default defineConfig({
  test: {
    globalSetup: "./test/global-setup.ts",
    fileParallelism: false,
    env: {
      ...(testDbUrl ? { DATABASE_URL: testDbUrl } : {}),
      // Force mock mode in tests regardless of the developer's environment.
      ANTHROPIC_API_KEY: "",
    },
  },
});

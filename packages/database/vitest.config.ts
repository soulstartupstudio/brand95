import { defineConfig } from "vitest/config";

const testDbUrl = process.env.TEST_DATABASE_URL;

export default defineConfig({
  test: {
    globalSetup: "./test/global-setup.ts",
    fileParallelism: false,
    env: {
      // Point the Prisma client in test workers at the test database.
      ...(testDbUrl ? { DATABASE_URL: testDbUrl } : {}),
    },
  },
});

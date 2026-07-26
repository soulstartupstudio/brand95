import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Prepare the dedicated test database: apply migrations (non-destructive),
 * then empty all tables so every run starts from a clean slate.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Integration tests need a disposable database (see .env.example).",
    );
  }

  execSync("pnpm exec prisma migrate deploy", {
    cwd: new URL("..", import.meta.url).pathname,
    // Override DIRECT_URL too — migrate uses it, and it must never point at
    // the real database while tests run.
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: "inherit",
  });

  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    if (tables.length > 0) {
      const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

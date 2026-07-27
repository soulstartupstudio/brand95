import path from "node:path";
import { config } from "dotenv";
import type { NextConfig } from "next";

// Environment lives at the monorepo root; Next only auto-loads app-local .env.
config({ path: path.resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  transpilePackages: ["@brand95/domain", "@brand95/database", "@brand95/agents"],
};

export default nextConfig;

import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Local runs read DATABASE_URL from .env; variables already set (CI, Railway) win.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./app/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Keep the migrations table next to the app tables instead of creating a
  // separate `drizzle` schema.
  migrations: {
    schema: "public",
  },
});

import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load dotenv here to ensure it runs before accessing process.env
dotenv.config({ path: ".env.local", override: true }); // Use override to ensure it loads if already loaded

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  // Allow running without DATABASE_URL if VERCEL env var is set (for Vercel build)
  if (!process.env.VERCEL) {
    console.error("❌ DATABASE_URL environment variable is not set.");
    // Throw an error to prevent using the dummy URL locally
    throw new Error("DATABASE_URL environment variable is required for local development. Please check your .env.local file.");
  } else {
    console.log("ℹ️ VERCEL environment detected, DATABASE_URL check skipped for build.");
  }
}

export default defineConfig({ // Define config object directly
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql", // Change dialect to postgresql
  // driver property removed, let drizzle-kit infer or use default
dbCredentials: {
  // Use DATABASE_URL. If it's missing locally, the error above will stop execution.
  // For Vercel builds where it might be missing initially, provide a placeholder.
  url: databaseUrl || "postgresql://vercel:placeholder@host/db",
},
  verbose: true, // Optional: for more detailed output during migrations
  strict: true, // Optional: for stricter schema checks
}); // Close defineConfig

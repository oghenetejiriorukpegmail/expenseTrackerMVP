import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from "dotenv";

console.log("Running database migrations...");

// Load environment variables
dotenv.config({ path: ".env.local" });

// ESM equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Wrap the async code in an async function
async function runMigrations() {
  try {
    // Construct the path to the migrations folder
    const migrationsFolder = path.join(__dirname, '..', 'migrations');
    console.log(`Migrations folder: ${migrationsFolder}`);

    // Use PostgreSQL for both development and production
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set.");
    }

    console.log("Connecting to PostgreSQL database...");
    
    // Import PostgreSQL modules
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { Pool } = await import('pg');
    
    // Create a pg Pool with proper SSL configuration for Supabase
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Required for Supabase PostgreSQL
      }
    });

    const db = drizzle(pool);
    console.log("PostgreSQL connection established.");

    // Run migrations
    console.log("Applying PostgreSQL migrations...");
    await migrate(db, { migrationsFolder });
    console.log("PostgreSQL migrations applied successfully!");
    
    await pool.end();
    console.log("PostgreSQL connection closed.");
    
    process.exit(0); // Exit successfully
  } catch (error) {
    console.error("Error running migrations:", error);
    process.exit(1); // Exit with error
  }
}

// Execute the async function
runMigrations();
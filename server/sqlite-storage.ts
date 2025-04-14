import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'; // Use node-postgres adapter
import { Pool } from 'pg'; // Use pg Pool
import { migrate } from 'drizzle-orm/node-postgres/migrator'; // Use node-postgres migrator
import * as schema from '@shared/schema';
import type { User, InsertUser, Trip, InsertTrip, Expense, InsertExpense } from "@shared/schema";
import { eq, and, desc } from 'drizzle-orm'; // Import desc for ordering
import session from "express-session";
import connectPgSimple from 'connect-pg-simple'; // Import pg session store

import { IStorage } from './storage'; // Import the interface
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" }); // Load .env.local first if it exists

export class PostgresStorage implements IStorage { // Renamed class
  private db: NodePgDatabase<typeof schema>; // Drizzle instance with correct type
  private pool: Pool; // Raw pg Pool instance
  public sessionStore!: session.Store; // Use definite assignment assertion

  // Private constructor to enforce initialization via async method
  private constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set.");
    }
    // Create a pg Pool
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Add SSL config if required by Supabase/Vercel (often needed for production)
      // ssl: {
      //   rejectUnauthorized: false // Adjust as needed for your provider/environment
      // }
    });
    this.db = drizzle(this.pool, { schema, logger: false }); // Pass pool to Drizzle
  }

  // Public async initialization method
  public static async initialize(): Promise<PostgresStorage> {
    const instance = new PostgresStorage(); // Call constructor without path

    // Run migrations using the Drizzle instance (now async)
    console.log("Running database migrations...");
    try {
        // Use the async migrate function for node-postgres
        await migrate(instance.db, { migrationsFolder: './migrations' });
        console.log("Migrations complete.");
    } catch (error) {
        console.error("Error running migrations:", error);
        // Decide if you want to throw or handle this error, especially in production
        throw error; // Rethrowing might be safer during startup
    }

    // Initialize Postgres session store
    const PgStore = connectPgSimple(session);
    instance.sessionStore = new PgStore({
        pool: instance.pool, // Pass the pg Pool instance
        createTableIfMissing: true, // Automatically create the session table
        // Customize table name or schema if needed
        // tableName: 'user_sessions',
        // schemaName: 'public'
    });
    console.log("Postgres session store initialized.");
    return instance;
  }

  // --- User methods ---
  async getUserById(id: number): Promise<User | undefined> { // Renamed from getUser
    // Use prepared statements for potentially better performance
    // const prepared = this.db.select().from(schema.users).where(eq(schema.users.id, sql.placeholder('id'))).prepare();
    // const result = await prepared.execute({ id });
    const result = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
     // Ensure case-insensitive comparison if needed (SQLite is often case-insensitive by default for ASCII)
     // Using lower() function for explicit case-insensitivity:
     // const result = await this.db.select().from(schema.users).where(eq(sql`lower(${schema.users.username})`, username.toLowerCase())).limit(1);
    const result = await this.db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    return result[0];
  }

  async createUser(userData: InsertUser): Promise<User> {
    // Ensure all required fields for InsertUser are provided if not handled by DB defaults
    const result = await this.db.insert(schema.users).values(userData).returning();
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Ensure case-insensitive comparison if needed
    const result = await this.db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return result[0];
  }

  async updateUserProfile(userId: number, profileData: { firstName: string; lastName?: string | null; phoneNumber?: string | null; email: string; bio?: string | null }): Promise<User | undefined> {
    // Construct the update object dynamically to only include provided fields
    const updateData: Partial<typeof schema.users.$inferInsert> = {};
    if (profileData.firstName !== undefined) updateData.firstName = profileData.firstName;
    if (profileData.lastName !== undefined) updateData.lastName = profileData.lastName ?? ''; // Default to empty string if null/undefined
    if (profileData.phoneNumber !== undefined) updateData.phoneNumber = profileData.phoneNumber ?? ''; // Default to empty string if null/undefined
    if (profileData.email !== undefined) updateData.email = profileData.email;
    if (profileData.bio !== undefined) updateData.bio = profileData.bio ?? null; // Use null if bio is undefined

    const result = await this.db.update(schema.users)
      .set(updateData) // Use the dynamically constructed object
      .where(eq(schema.users.id, userId))
      .returning();
    
    if (result.length === 0) {
      return undefined; // User not found
    }
    return result[0];
  }

  async updateUserPassword(userId: number, newPasswordHash: string): Promise<void> {
    const result = await this.db.update(schema.users)
      .set({ password: newPasswordHash })
      .where(eq(schema.users.id, userId))
      .returning({ id: schema.users.id }); // Return something to check if update happened

    if (result.length === 0) {
      throw new Error(`User with ID ${userId} not found for password update.`);
    }
  }

  // Removed duplicate updateUserPassword method
  // --- Trip methods ---
  async getTrip(id: number): Promise<Trip | undefined> {
    const result = await this.db.select().from(schema.trips).where(eq(schema.trips.id, id)).limit(1);
    return result[0];
  }

  async getTripsByUserId(userId: number): Promise<Trip[]> {
    // Add ordering if desired, e.g., by creation date
    return this.db.select().from(schema.trips).where(eq(schema.trips.userId, userId)).orderBy(desc(schema.trips.createdAt));
  }

  async createTrip(tripData: InsertTrip & { userId: number }): Promise<Trip> {
     // Ensure all required fields for InsertTrip are provided
     if (!tripData.name) {
        throw new Error("Trip name is required");
     }
     // Add default description if missing?
     const dataToInsert = {
        description: '', // Provide default if schema requires it and it's missing
        ...tripData,
     };
    const result = await this.db.insert(schema.trips).values(dataToInsert).returning();
    return result[0];
  }

  async updateTrip(id: number, tripData: Partial<InsertTrip>): Promise<Trip> {
     const result = await this.db.update(schema.trips)
       .set(tripData)
       .where(eq(schema.trips.id, id))
       .returning();
     if (result.length === 0) {
        throw new Error(`Trip with ID ${id} not found`);
     }
     return result[0];
  }

  async deleteTrip(id: number): Promise<void> {
    // Use transaction for atomicity
    await this.db.transaction(async (tx) => {
        const trip = await tx.select({ name: schema.trips.name, userId: schema.trips.userId })
                             .from(schema.trips)
                             .where(eq(schema.trips.id, id))
                             .limit(1);

        if (!trip[0]) {
            throw new Error(`Trip with ID ${id} not found`);
        }
        // Delete associated expenses first
        await tx.delete(schema.expenses).where(and(eq(schema.expenses.userId, trip[0].userId), eq(schema.expenses.tripName, trip[0].name)));
        // Now delete the trip
        await tx.delete(schema.trips).where(eq(schema.trips.id, id));
    });
  }

  // --- Expense methods ---
  async getExpense(id: number): Promise<Expense | undefined> {
     const result = await this.db.select().from(schema.expenses).where(eq(schema.expenses.id, id)).limit(1);
     // Drizzle should map REAL to number directly
     // if (result[0]) {
     //    return { ...result[0], cost: parseFloat(result[0].cost as string) };
     // }
     return result[0]; // Return directly, cost should be number
  }

  async getExpensesByUserId(userId: number): Promise<Expense[]> {
    const results = await this.db.select().from(schema.expenses)
                                .where(eq(schema.expenses.userId, userId))
                                .orderBy(desc(schema.expenses.date)); // Order by date descending
    // Drizzle should map REAL to number directly
    // return results.map(exp => ({ ...exp, cost: parseFloat(exp.cost as string) }));
    return results; // Return directly, cost should be number
  }

  async getExpensesByTripName(userId: number, tripName: string): Promise<Expense[]> {
    const results = await this.db.select().from(schema.expenses)
      .where(and(eq(schema.expenses.userId, userId), eq(schema.expenses.tripName, tripName)))
      .orderBy(desc(schema.expenses.date)); // Order by date descending
     // Drizzle should map REAL to number directly
     // return results.map(exp => ({ ...exp, cost: parseFloat(exp.cost as string) }));
     return results; // Return directly, cost should be number
  }

  async createExpense(expenseData: InsertExpense & { userId: number, receiptPath?: string | null }): Promise<Expense> {
     // Ensure all required fields for InsertExpense are provided
     const requiredFields: (keyof InsertExpense)[] = ['date', 'type', 'vendor', 'location', 'cost', 'tripName'];
     for (const field of requiredFields) {
        if (expenseData[field] === undefined || expenseData[field] === null) {
            // Ensure cost is not undefined/null before checking if it's a number
            if (field === 'cost' && typeof expenseData.cost !== 'number') {
                 throw new Error(`Missing or invalid required expense field: ${field}`);
            } else if (field !== 'cost') {
                 throw new Error(`Missing required expense field: ${field}`);
            }
        }
     }

     const dataToInsert = {
        ...expenseData,
        // Cost should be a number as defined in InsertExpense and mapped to REAL
        cost: expenseData.cost,
        receiptPath: expenseData.receiptPath || null,
        // Ensure default values if needed by schema and not provided
        comments: expenseData.comments ?? '',
     };
     const result = await this.db.insert(schema.expenses).values(dataToInsert).returning();
     // Cost should already be a number
     return result[0];
  }

  async updateExpense(id: number, expenseData: Partial<InsertExpense & { receiptPath?: string | null }>): Promise<Expense> {
    // Create a new object for data to update to avoid modifying original expenseData
    const dataToUpdate: Partial<typeof schema.expenses.$inferInsert> = {};

    // Copy allowed fields from expenseData to dataToUpdate
    for (const key in expenseData) {
        if (Object.prototype.hasOwnProperty.call(expenseData, key)) {
            const typedKey = key as keyof typeof expenseData;
            // Directly assign the value, Drizzle handles type mapping for 'real'
            (dataToUpdate as any)[typedKey] = expenseData[typedKey];
        }
    }
     // Add updatedAt timestamp
     dataToUpdate.updatedAt = new Date();


    const result = await this.db.update(schema.expenses)
      .set(dataToUpdate)
      .where(eq(schema.expenses.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error(`Expense with ID ${id} not found`);
    }
    // Cost should already be a number
    return result[0];
  }

  async deleteExpense(id: number): Promise<void> {
    await this.db.delete(schema.expenses).where(eq(schema.expenses.id, id));
  }
}
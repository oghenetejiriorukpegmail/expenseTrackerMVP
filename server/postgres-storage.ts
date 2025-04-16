import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'; // Use node-postgres adapter
import pg from 'pg'; // Import default export
const { Pool } = pg; // Destructure Pool from the default export
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
  private pool: pg.Pool; // Raw pg Pool instance
  public sessionStore!: session.Store; // Use definite assignment assertion

  // Private constructor to enforce initialization via async method
  private constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set.");
    }
    
    console.log("Using PostgreSQL database with connection string:", process.env.DATABASE_URL);
    
    // Create a pg Pool with proper SSL configuration for Supabase
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Required for Supabase PostgreSQL
      }
    });
    
    this.db = drizzle(this.pool, { schema, logger: true }); // Enable logger for debugging
  }

  // Public async initialization method
  public static async initialize(): Promise<PostgresStorage> {
    const instance = new PostgresStorage(); // Call constructor without path

    // Skip migrations since tables already exist in Supabase
    console.log("Skipping migrations as tables already exist in Supabase");
    
    // Test database connection
    try {
      const result = await instance.db.select().from(schema.users).limit(1);
      console.log("Database connection test successful:", result.length > 0 ? "Found users" : "No users found");
    } catch (error) {
      console.error("Database connection test failed:", error);
      // Don't throw the error, just log it
    }

    // Initialize PostgreSQL session store for both dev and prod
    const PgStore = connectPgSimple(session);
    instance.sessionStore = new PgStore({
      pool: instance.pool, // Pass the pg Pool instance
      createTableIfMissing: true, // Automatically create the session table
    });
    console.log("PostgreSQL session store initialized.");
    
    return instance;
  }

  // --- User methods ---
  async getUserById(id: number): Promise<User | undefined> { // Renamed from getUser
    try {
      const result = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error in getUserById:", error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await this.db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error in getUserByUsername:", error);
      throw error;
    }
  }

  async createUser(userData: InsertUser): Promise<User> {
    try {
      const result = await this.db.insert(schema.users).values(userData).returning();
      return result[0];
    } catch (error) {
      console.error("Error in createUser:", error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await this.db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error in getUserByEmail:", error);
      throw error;
    }
  }

  async updateUserProfile(userId: number, profileData: { firstName: string; lastName?: string | null; phoneNumber?: string | null; email: string; bio?: string | null }): Promise<User | undefined> {
    try {
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
    } catch (error) {
      console.error("Error in updateUserProfile:", error);
      throw error;
    }
  }

  async updateUserPassword(userId: number, newPasswordHash: string): Promise<void> {
    try {
      const result = await this.db.update(schema.users)
        .set({ password: newPasswordHash })
        .where(eq(schema.users.id, userId))
        .returning({ id: schema.users.id }); // Return something to check if update happened

      if (result.length === 0) {
        throw new Error(`User with ID ${userId} not found for password update.`);
      }
    } catch (error) {
      console.error("Error in updateUserPassword:", error);
      throw error;
    }
  }

  // --- Trip methods ---
  async getTrip(id: number): Promise<Trip | undefined> {
    try {
      const result = await this.db.select().from(schema.trips).where(eq(schema.trips.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error("Error in getTrip:", error);
      throw error;
    }
  }

  async getTripsByUserId(userId: number): Promise<Trip[]> {
    try {
      // Add ordering if desired, e.g., by creation date
      return this.db.select().from(schema.trips).where(eq(schema.trips.userId, userId)).orderBy(desc(schema.trips.createdAt));
    } catch (error) {
      console.error("Error in getTripsByUserId:", error);
      throw error;
    }
  }

  async createTrip(tripData: InsertTrip & { userId: number }): Promise<Trip> {
    try {
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
    } catch (error) {
      console.error("Error in createTrip:", error);
      throw error;
    }
  }

  async updateTrip(id: number, tripData: Partial<InsertTrip>): Promise<Trip> {
    try {
      const result = await this.db.update(schema.trips)
        .set(tripData)
        .where(eq(schema.trips.id, id))
        .returning();
      if (result.length === 0) {
        throw new Error(`Trip with ID ${id} not found`);
      }
      return result[0];
    } catch (error) {
      console.error("Error in updateTrip:", error);
      throw error;
    }
  }

  async deleteTrip(id: number): Promise<void> {
    try {
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
    } catch (error) {
      console.error("Error in deleteTrip:", error);
      throw error;
    }
  }

  // --- Expense methods ---
  async getExpense(id: number): Promise<Expense | undefined> {
    try {
      const result = await this.db.select().from(schema.expenses).where(eq(schema.expenses.id, id)).limit(1);
      return result[0]; // Return directly, cost should be number
    } catch (error) {
      console.error("Error in getExpense:", error);
      throw error;
    }
  }

  async getExpensesByUserId(userId: number): Promise<Expense[]> {
    try {
      const results = await this.db.select().from(schema.expenses)
                                .where(eq(schema.expenses.userId, userId))
                                .orderBy(desc(schema.expenses.date)); // Order by date descending
      return results; // Return directly, cost should be number
    } catch (error) {
      console.error("Error in getExpensesByUserId:", error);
      throw error;
    }
  }

  async getExpensesByTripName(userId: number, tripName: string): Promise<Expense[]> {
    try {
      const results = await this.db.select().from(schema.expenses)
        .where(and(eq(schema.expenses.userId, userId), eq(schema.expenses.tripName, tripName)))
        .orderBy(desc(schema.expenses.date)); // Order by date descending
      return results; // Return directly, cost should be number
    } catch (error) {
      console.error("Error in getExpensesByTripName:", error);
      throw error;
    }
  }

  async createExpense(expenseData: InsertExpense & { userId: number, receiptPath?: string | null }): Promise<Expense> {
    try {
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
      return result[0];
    } catch (error) {
      console.error("Error in createExpense:", error);
      throw error;
    }
  }

  async updateExpense(id: number, expenseData: Partial<InsertExpense & { receiptPath?: string | null }>): Promise<Expense> {
    try {
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

      const result = await this.db.update(schema.expenses)
        .set(dataToUpdate)
        .where(eq(schema.expenses.id, id))
        .returning();

      if (result.length === 0) {
        throw new Error(`Expense with ID ${id} not found`);
      }
      return result[0];
    } catch (error) {
      console.error("Error in updateExpense:", error);
      throw error;
    }
  }

  async deleteExpense(id: number): Promise<void> {
    try {
      await this.db.delete(schema.expenses).where(eq(schema.expenses.id, id));
    } catch (error) {
      console.error("Error in deleteExpense:", error);
      throw error;
    }
  }
}
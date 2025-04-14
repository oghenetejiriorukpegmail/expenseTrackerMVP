// Import PostgreSQL core functions
import { pgTable, serial, text, integer, decimal, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm"; // Import sql helper for defaultNow()
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define users table for PostgreSQL
export const users = pgTable("users", {
  id: serial("id").primaryKey(), // Use serial for auto-incrementing primary key
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull().default(''), // Existing firstName
  lastName: text("last_name").notNull().default(''), // Add lastName, default to empty string
  phoneNumber: text("phone_number").notNull().default(''), // Add phoneNumber, default to empty string
  email: text("email").notNull().unique().default(''), // Existing email
  bio: text("bio"), // Existing optional bio
  // Store timestamps as integers (Unix epoch milliseconds) or ISO strings (text)
  // Using integer mode for simplicity with Date objects
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: false }).defaultNow(),
});

// Define trips table for PostgreSQL
export const trips = pgTable("trips", {
  id: serial("id").primaryKey(),
  // Ensure foreign key references integer type
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Add onDelete cascade if desired
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: false }).defaultNow(),
});

// Define expenses table for PostgreSQL
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Add onDelete cascade if desired
  type: text("type").notNull(),
  date: text("date").notNull(), // Keep date as text (YYYY-MM-DD) for simplicity
  vendor: text("vendor").notNull(),
  location: text("location").notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull(), // Use decimal for currency
  comments: text("comments"),
  tripName: text("trip_name").notNull(),
  receiptPath: text("receipt_path"),
  createdAt: timestamp("created_at", { mode: 'date', withTimezone: false }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'date', withTimezone: false }).defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  firstName: true, // Existing firstName
  lastName: true, // Include lastName in insert schema
  phoneNumber: true, // Include phoneNumber in insert schema
  email: true, // Existing email
  // bio is optional, not included by default
});

export const insertTripSchema = createInsertSchema(trips).pick({
  name: true,
  description: true,
}); // Removed .omit({ userId: true })

export const insertExpenseSchema = createInsertSchema(expenses).pick({
  type: true,
  date: true,
  vendor: true,
  location: true,
  cost: true,
  comments: true,
  tripName: true,
}); // Removed .omit({ userId: true })

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof trips.$inferSelect;

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

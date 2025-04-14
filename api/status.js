import { storage as storagePromise } from "../server/storage.js";

// Simple health check endpoint to verify database connectivity
export default async function handler(req, res) {
  try {
    console.log("[Status Check] Verifying database connection");
    
    // Log environment details
    console.log({
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      DATABASE_URL: process.env.DATABASE_URL ? "Set (value hidden)" : "Not set"
    });
    
    // Try to initialize storage/database connection
    const storage = await storagePromise;
    
    // If we get here, the database connection was successful
    const response = {
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: "connected",
      message: "API is operational"
    };
    
    console.log("[Status Check] Success", response);
    res.status(200).json(response);
  } catch (error) {
    // Log the error details
    console.error("[Status Check] Failed to connect to database:", error);
    
    const response = {
      status: "error",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: "error",
      message: "Failed to connect to database",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
    
    res.status(500).json(response);
  }
}
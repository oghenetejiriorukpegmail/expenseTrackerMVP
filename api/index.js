import express from "express";
import helmet from "helmet";
import { registerRoutes } from "../server/routes.js";
import { storage as storagePromise } from "../server/storage.js";
import { setupNotFoundHandler } from "./not-found-handler.js";
import fs from "fs";
import path from "path";
import { setupAuth } from "../server/auth.js";
import { initializeEnvFromConfig } from "../server/config.js";

// Configure express app
const app = express();

// Security headers for production
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[API] ${req.method} ${path} ${res.statusCode} in ${duration}ms`);
  });

  next();
});

// Initialize environment variables
initializeEnvFromConfig();

// Promise for the fully-initialized Express app
const appPromise = (async () => {
  try {
    // Log environment details for debugging
    console.log("Node Environment:", process.env.NODE_ENV);
    console.log("Vercel Environment:", process.env.VERCEL);
    console.log("Current Directory:", process.cwd());

    // List deployed files to help debug missing files
    try {
      const apiDir = path.join(process.cwd(), 'api');
      const serverDir = path.join(process.cwd(), 'server');
      
      if (fs.existsSync(apiDir)) {
        console.log("API directory contents:", fs.readdirSync(apiDir));
      }
      
      if (fs.existsSync(serverDir)) {
        console.log("Server directory contents:", fs.readdirSync(serverDir));
      }
    } catch (err) {
      console.error("Error listing directories:", err);
    }

    // Initialize storage (database connection)
    const storage = await storagePromise;
    console.log("Storage initialized successfully.");

    // Setup authentication
    setupAuth(app, storage.sessionStore, storage);
    console.log("Auth setup complete.");

    // Register API routes
    const server = await registerRoutes(app, storage);
    console.log("API routes registered.");
    
    // Error handling middleware
    app.use((err, _req, res, _next) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      console.error("Server error:", err);
    });

    // Add 404 handler to catch unhandled routes
    setupNotFoundHandler(app);
    console.log("404 handler registered.");

    return app;
  } catch (error) {
    console.error("Error during API initialization:", error);
    throw error;
  }
})();

// Vercel serverless function handler
export default async (req, res) => {
  try {
    // Detailed request logging to help diagnose issues
    console.log(`[Serverless] ${req.method} ${req.url}`);
    console.log(`User-Agent: ${req.headers['user-agent']}`);
    console.log(`Accept: ${req.headers['accept']}`);
    console.log(`Referer: ${req.headers['referer'] || 'None'}`);
    console.log(`Query params: ${JSON.stringify(req.query)}`);
    
    // Wait for app to be fully initialized
    const initializedApp = await appPromise;
    
    // Then let Express handle the request
    return initializedApp(req, res);
  } catch (error) {
    console.error("Error handling serverless request:", error);
    console.error(error.stack);
    res.status(500).json({
      message: "Internal Server Error", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
};
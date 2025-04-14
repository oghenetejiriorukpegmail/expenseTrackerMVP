import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet"; // Import helmet
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage as storagePromise } from "./storage"; // Import the promise
import { setupAuth } from "./auth"; // Import setupAuth
import { initializeEnvFromConfig } from "./config"; // Import config initialization

// For Vercel serverless deployment
export const config = {
  api: {
    bodyParser: false, // We're using Express's body parser
  },
};

const app = express();

// Add helmet middleware for security headers
// Loosen CSP in development to allow Vite HMR and React Refresh
if (process.env.NODE_ENV !== 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'"], // Allow inline scripts for Vite
        "connect-src": ["'self'", "ws:"], // Allow WebSocket connections for HMR
      },
    }
  }));
} else {
  app.use(helmet()); // Use default helmet settings in production
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Initialize environment variables from config file
initializeEnvFromConfig();

// Create a Promise that will resolve to our fully configured Express app
const appPromise = (async () => {
  try {
    // Await the storage initialization
    const storage = await storagePromise;
    console.log("Storage initialized successfully.");

    // Setup auth with the initialized storage and session store
    setupAuth(app, storage.sessionStore, storage);
    console.log("Auth setup complete.");

    // Register routes, passing the initialized storage
    const server = await registerRoutes(app, storage);
    console.log("Routes registered.");
    
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      console.error("Server error:", err);
    });

    // Setup Vite in development or static file serving in production
    if (process.env.NODE_ENV !== "production") {
      await setupVite(app, server);
    } else {
      // Log the environment to help with debugging
      log(`Running in environment: NODE_ENV=${process.env.NODE_ENV}, VERCEL=${process.env.VERCEL}`);
      serveStatic(app);
    }

    // Start server for local development but not in Vercel environment
    const port = process.env.PORT || 5000;
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
    
    if (process.env.VERCEL !== '1') {
      server.listen({
        port,
        host,
      }, () => {
        log(`serving on ${host}:${port}`);
      });
    } else {
      log('Running in Vercel serverless environment - not starting HTTP server');
      log('Static files will be served from the serverless function');
    }
    
    return app;
  } catch (error) {
    console.error("Error during app initialization:", error);
    throw error;
  }
})();

// For Vercel serverless function handler
export default async (req: Request, res: Response) => {
  try {
    // Log incoming requests to help with debugging
    console.log(`[serverless] Handling ${req.method} request to ${req.url}`);
    
    // Wait for app to be fully initialized
    const initializedApp = await appPromise;
    
    // Then let Express handle the request
    return initializedApp(req, res);
  } catch (error) {
    console.error("Error handling serverless request:", error);
    console.error(error);
    res.status(500).json({ message: "Internal Server Error", details: error instanceof Error ? error.message : String(error) });
  }
};

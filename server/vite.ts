import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // Determine the correct static files path based on environment
  let distPath;
  
  if (process.env.VERCEL === '1') {
    // In Vercel, the files are in a different location relative to the serverless function
    // This uses the working directory of the serverless function
    distPath = path.resolve('./dist/public');
    log(`Vercel environment detected, serving static files from: ${distPath}`, "static");
  } else {
    // Standard environment - use the path relative to this file
    const projectRoot = path.resolve(__dirname, "..");
    distPath = path.join(projectRoot, "dist", "public");
    log(`Standard environment, serving static files from: ${distPath}`, "static");
    
    // Only check if directory exists in non-Vercel environments
    if (!fs.existsSync(distPath)) {
      throw new Error(
        `Could not find the build directory: ${distPath}, make sure to build the client first`,
      );
    }
  }

  // Log the directory structure to help with debugging in Vercel
  if (process.env.VERCEL === '1') {
    try {
      const currentDir = process.cwd();
      log(`Current working directory: ${currentDir}`, "static");
      
      // Try to list the dist directory contents
      if (fs.existsSync('./dist')) {
        const distContents = fs.readdirSync('./dist');
        log(`Contents of ./dist: ${JSON.stringify(distContents)}`, "static");
        
        if (fs.existsSync('./dist/public')) {
          const publicContents = fs.readdirSync('./dist/public');
          log(`Contents of ./dist/public: ${JSON.stringify(publicContents)}`, "static");
        }
      }
    } catch (error) {
      log(`Error listing directory contents: ${error}`, "static");
    }
  }

  // Serve static files with options optimized for production
  app.use(express.static(distPath, {
    maxAge: '1d', // Cache static assets for 1 day
    etag: true,   // Enable ETags for caching
    index: false  // Don't automatically serve index.html (we handle this manually below)
  }));

  // Fallback for SPA: Send index.html for GET requests that accept HTML and are not API routes
  app.get('*', (req, res, next) => {
    // Check if it's a GET request accepting HTML and not an API route
    if (req.method === 'GET' && req.accepts('html') && !req.path.startsWith('/api/')) {
      const indexPath = path.join(distPath, "index.html");
      log(`Serving SPA fallback: ${indexPath} for path: ${req.path}`, "static");
      
      // Check if the file exists first to provide better error messages
      if (process.env.VERCEL !== '1' && !fs.existsSync(indexPath)) {
        log(`Warning: index.html not found at ${indexPath}`, "static");
      }
      
      res.sendFile(indexPath, (err) => {
        if (err) {
          log(`Error serving index.html: ${err.message}`, "static");
          // For Vercel, provide more detailed error information
          if (process.env.VERCEL === '1') {
            log(`Detailed error: ${JSON.stringify(err)}`, "static");
          }
          next(err);
        }
      });
    } else {
      next();
    }
  });
}

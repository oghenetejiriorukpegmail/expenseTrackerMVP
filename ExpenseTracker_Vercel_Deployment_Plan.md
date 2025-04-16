# ExpenseTracker Vercel Deployment Plan

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Prioritized Issues](#prioritized-issues)
4. [Detailed Implementation Plan](#detailed-implementation-plan)
5. [Deployment Process](#deployment-process)
6. [Architecture Diagrams](#architecture-diagrams)
7. [Potential Risks and Challenges](#potential-risks-and-challenges)
8. [Post-Deployment Verification](#post-deployment-verification)
9. [Monitoring and Maintenance](#monitoring-and-maintenance)

## Executive Summary

This document outlines a comprehensive plan for deploying the ExpenseTracker application to Vercel. The plan addresses key issues identified in the current codebase, provides step-by-step implementation instructions, and includes deployment procedures. The deployment will utilize Supabase for both PostgreSQL database and file storage, while supporting all OCR options for receipt processing.

## Current State Analysis

The ExpenseTracker app is currently in transition from SQLite to PostgreSQL:

1. **Database Configuration**:
   - PostgreSQL is configured as the primary database
   - Database URL is stored in `.env.local` pointing to a Supabase instance
   - Drizzle ORM is used for database operations
   - Some migration scripts still reference SQLite

2. **Vercel Configuration**:
   - `vercel.json` is properly configured with correct output directory and routes
   - Build process includes prebuild, build, and postbuild steps
   - Serverless functions are set up for API endpoints

3. **Environment Variables**:
   - App loads environment variables from `.env.local`
   - OCR API keys can be configured for various services

4. **File Storage**:
   - Currently stores uploaded receipts locally, which won't work in serverless

5. **Security**:
   - Helmet is configured for both development and production
   - Session cookie security settings are in place

## Prioritized Issues

Here's a prioritized list of issues that need to be addressed:

1. **Database Migration Script Update** - Critical
   - Update `server/migrate.ts` to use PostgreSQL instead of SQLite
   - Rename `server/sqlite-storage.ts` to reflect PostgreSQL usage

2. **File Storage Implementation** - Critical
   - Implement Supabase Storage for uploaded receipts
   - Update file upload/download logic

3. **Environment Variables Configuration** - Critical
   - Transfer database credentials to Vercel environment variables
   - Configure OCR API keys in Vercel

4. **Build Process Optimization** - Important
   - Review and optimize the build process
   - Ensure proper caching of static assets

5. **Security Enhancements** - Important
   - Verify Helmet configuration for production
   - Ensure session cookie security settings

6. **Documentation Update** - Nice-to-have
   - Update README.md to reflect PostgreSQL usage
   - Add deployment instructions for Vercel

## Detailed Implementation Plan

### Phase 1: Database Configuration (Estimated time: 2-3 hours)

#### 1.1 Update Migration Script

1. Rename `server/sqlite-storage.ts` to `server/postgres-storage.ts` for clarity
2. Update `server/migrate.ts` to use PostgreSQL:

```typescript
// server/migrate.ts
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from "dotenv";

console.log("Running database migrations...");

// Load environment variables
dotenv.config({ path: ".env.local" });

// ESM equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set.");
  }

  // Create a pg Pool with proper SSL configuration
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : undefined
  });

  const db = drizzle(pool);
  console.log("Database connection established.");

  // Construct the path to the migrations folder
  const migrationsFolder = path.join(__dirname, '..', 'migrations');
  console.log(`Migrations folder: ${migrationsFolder}`);

  // Run migrations
  await migrate(db, { migrationsFolder });
  console.log("Migrations applied successfully!");
  
  // Close the database connection
  await pool.end();
  process.exit(0);
} catch (error) {
  console.error("Error running migrations:", error);
  process.exit(1);
}
```

#### 1.2 Update Storage References

1. Update imports in `server/storage.ts`:

```typescript
// Update the import to use the renamed file
import { PostgresStorage } from './postgres-storage';
```

### Phase 2: File Storage Implementation (Estimated time: 4-5 hours)

#### 2.1 Install Supabase Storage SDK

```bash
npm install @supabase/storage-js
```

#### 2.2 Create Storage Service

Create a new file `server/supabase-storage.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: ".env.local" });

// Extract Supabase URL and key from the DATABASE_URL
// Format: postgresql://postgres.[project_ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
const extractSupabaseInfo = () => {
  const dbUrl = process.env.DATABASE_URL || '';
  const matches = dbUrl.match(/postgresql:\/\/postgres\.([^:]+):([^@]+)@/);
  
  if (!matches || matches.length < 3) {
    throw new Error('Could not extract Supabase project reference from DATABASE_URL');
  }
  
  const projectRef = matches[1];
  const supabaseUrl = `https://${projectRef}.supabase.co`;
  // Note: You'll need to set SUPABASE_SERVICE_KEY in your environment variables
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
  
  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_KEY environment variable is not set');
  }
  
  return { supabaseUrl, supabaseKey };
};

export class SupabaseStorageService {
  private supabase;
  private bucketName = 'expense-receipts';
  
  constructor() {
    const { supabaseUrl, supabaseKey } = extractSupabaseInfo();
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }
  
  async initialize() {
    // Check if bucket exists, create if it doesn't
    const { data: buckets } = await this.supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === this.bucketName);
    
    if (!bucketExists) {
      await this.supabase.storage.createBucket(this.bucketName, {
        public: false,
        fileSizeLimit: 10485760, // 10MB
      });
      console.log(`Created storage bucket: ${this.bucketName}`);
    }
    
    return this;
  }
  
  async uploadFile(filePath: string, userId: number, fileName: string): Promise<string> {
    // Read file from local path
    const fileBuffer = fs.readFileSync(filePath);
    
    // Generate a unique path in the bucket
    const storagePath = `user_${userId}/${Date.now()}_${fileName}`;
    
    // Upload to Supabase
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: this.getContentType(fileName),
        upsert: false
      });
    
    if (error) {
      throw new Error(`Error uploading file: ${error.message}`);
    }
    
    // Return the path that can be used to retrieve the file
    return storagePath;
  }
  
  async getFileUrl(storagePath: string): Promise<string> {
    const { data } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(storagePath, 3600); // 1 hour expiry
    
    if (!data?.signedUrl) {
      throw new Error(`Could not generate signed URL for ${storagePath}`);
    }
    
    return data.signedUrl;
  }
  
  async deleteFile(storagePath: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .remove([storagePath]);
    
    if (error) {
      throw new Error(`Error deleting file: ${error.message}`);
    }
  }
  
  private getContentType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
      case '.pdf': return 'application/pdf';
      case '.png': return 'image/png';
      case '.jpg':
      case '.jpeg': return 'image/jpeg';
      case '.gif': return 'image/gif';
      default: return 'application/octet-stream';
    }
  }
}

// Export a singleton instance
export const storageService = new SupabaseStorageService().initialize();
```

#### 2.3 Update File Upload Handler

Modify the file upload handler in `server/routes.ts` to use Supabase Storage:

```typescript
// Add this import at the top
import { storageService } from './supabase-storage.js';

// Then update the upload endpoint
app.post('/api/expenses/upload', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const userId = req.user.id;
    const originalFilename = req.file.originalname;
    const localFilePath = req.file.path;
    
    // Upload to Supabase Storage
    const storagePath = await (await storageService).uploadFile(
      localFilePath, 
      userId, 
      originalFilename
    );
    
    // Delete the local file after upload
    fs.unlinkSync(localFilePath);
    
    // Return the storage path to be saved in the database
    res.json({ 
      message: 'File uploaded successfully',
      receiptPath: storagePath
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Error uploading file' });
  }
});

// Add a new endpoint to get a signed URL for a receipt
app.get('/api/expenses/receipt/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const expenseId = parseInt(req.params.id);
    const expense = await storage.getExpense(expenseId);
    
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    
    if (expense.userId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    if (!expense.receiptPath) {
      return res.status(404).json({ message: 'No receipt attached to this expense' });
    }
    
    // Get a signed URL from Supabase
    const signedUrl = await (await storageService).getFileUrl(expense.receiptPath);
    
    res.json({ url: signedUrl });
  } catch (error) {
    console.error('Error getting receipt URL:', error);
    res.status(500).json({ message: 'Error getting receipt URL' });
  }
});
```

#### 2.4 Update Client-Side Receipt Handling

Update the client-side code to use the new signed URL endpoint:

```typescript
// In the client component that displays receipts
const fetchReceiptUrl = async (expenseId) => {
  const response = await fetch(`/api/expenses/receipt/${expenseId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch receipt URL');
  }
  const data = await response.json();
  return data.url;
};
```

### Phase 3: Environment Variables Configuration (Estimated time: 1-2 hours)

#### 3.1 Prepare Environment Variables for Vercel

Create a `.env.production` file with placeholders (do not include actual values):

```
DATABASE_URL=
SUPABASE_SERVICE_KEY=
SESSION_SECRET=
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=
```

#### 3.2 Configure Vercel Environment Variables

In the Vercel dashboard:

1. Go to your project settings
2. Navigate to the "Environment Variables" section
3. Add the following variables:
   - `DATABASE_URL`: Copy from `.env.local`
   - `SUPABASE_SERVICE_KEY`: Generate from Supabase dashboard
   - `SESSION_SECRET`: Generate a strong random string
   - `GEMINI_API_KEY`: (Optional) Add if using Google Gemini
   - `OPENAI_API_KEY`: (Optional) Add if using OpenAI
   - `ANTHROPIC_API_KEY`: (Optional) Add if using Anthropic
   - `OPENROUTER_API_KEY`: (Optional) Add if using OpenRouter

### Phase 4: Build Process Optimization (Estimated time: 2-3 hours)

#### 4.1 Update Build Script

Modify the build script in `package.json` to optimize for production:

```json
"build": "NODE_ENV=production vite build && esbuild api/index.js --platform=node --bundle --format=esm --outdir=.vercel/output/functions/api --external:pg --external:better-sqlite3 --external:sqlite3 --minify",
```

#### 4.2 Configure Vite for Production

Update `vite.config.ts` to optimize for production:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/public',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'wouter'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            // Add other UI libraries
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
});
```

### Phase 5: Security Enhancements (Estimated time: 1-2 hours)

#### 5.1 Update Helmet Configuration

Enhance the Helmet configuration in `server/index.ts` and `api/index.js`:

```typescript
// Production Helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "*.supabase.co"],
      connectSrc: ["'self'", "*.supabase.co"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // May need to adjust based on your app's requirements
}));
```

#### 5.2 Enhance Session Security

Update session configuration in `server/auth.ts`:

```typescript
// In the session configuration
app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'expense-tracker-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax',
    },
  })
);
```

### Phase 6: Documentation Update (Estimated time: 1-2 hours)

#### 6.1 Update README.md

Update the README.md to reflect PostgreSQL usage and add Vercel deployment instructions. See the implementation plan for the full updated README content.

## Deployment Process

```mermaid
flowchart TD
    A[Start Deployment Process] --> B[Prepare Supabase Project]
    B --> B1[Create Storage Bucket]
    B --> B2[Generate Service Key]
    B1 --> C[Implement Code Changes]
    B2 --> C
    C --> C1[Update Database Scripts]
    C --> C2[Implement File Storage]
    C --> C3[Update Security Config]
    C --> C4[Optimize Build Process]
    C1 --> D[Test Locally]
    C2 --> D
    C3 --> D
    C4 --> D
    D --> E[Setup Vercel Project]
    E --> F[Configure Environment Variables]
    F --> G[Deploy to Vercel]
    G --> H[Verify Deployment]
    H --> I[Monitor & Maintain]
```

### Step 1: Prepare the Supabase Project

1. **Create a Storage Bucket:**
   - Log in to the Supabase dashboard
   - Navigate to Storage
   - Create a new bucket named "expense-receipts"
   - Set the bucket to private
   - Configure CORS if needed

2. **Generate a Service Key:**
   - In the Supabase dashboard, go to Project Settings > API
   - Generate a new service role key
   - Save this key securely for use in the Vercel environment variables

### Step 2: Implement Code Changes

1. Follow the implementation plan to make all the necessary code changes:
   - Rename and update the database migration script
   - Implement Supabase Storage for file uploads
   - Update security configurations
   - Optimize the build process
   - Update documentation

2. Test the changes locally:
   ```bash
   npm run dev
   ```

### Step 3: Deploy to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy to Vercel:**
   ```bash
   vercel
   ```

4. **Configure Environment Variables:**
   - In the Vercel dashboard, go to your project settings
   - Navigate to the "Environment Variables" section
   - Add all the required environment variables:
     - `DATABASE_URL`
     - `SUPABASE_SERVICE_KEY`
     - `SESSION_SECRET`
     - OCR API keys as needed

5. **Trigger a new deployment:**
   ```bash
   vercel --prod
   ```

## Architecture Diagrams

### Updated Architecture with Supabase Integration

```mermaid
flowchart TD
    subgraph Client
        A[React Frontend]
        B[TanStack Query]
        C[Tailwind/Shadcn UI]
    end
    
    subgraph Vercel
        D[Serverless Functions]
        E[Static Assets]
        F[API Routes]
    end
    
    subgraph Supabase
        G[PostgreSQL Database]
        H[Storage Bucket]
    end
    
    subgraph External_Services
        I[Google Gemini API]
        J[OpenAI Vision API]
        K[Anthropic Claude API]
        L[OpenRouter API]
    end
    
    A --> B
    B --> F
    F --> D
    D --> G
    D --> H
    D --> I
    D --> J
    D --> K
    D --> L
    
    %% File Upload Flow
    A -- "Upload Receipt" --> F
    F -- "Process Upload" --> D
    D -- "Store File" --> H
    D -- "Extract Data" --> I
    
    %% Database Operations
    D -- "CRUD Operations" --> G
    G -- "Query Results" --> D
    D -- "API Response" --> F
    F -- "Data" --> B
    B -- "Render" --> A
    
    %% Static Assets
    A -- "Request Assets" --> E
    E -- "Serve Assets" --> A
```

## Potential Risks and Challenges

1. **Database Connection Issues:**
   - **Risk:** Connection pooling might not be optimized for serverless functions
   - **Mitigation:** Configure proper connection pooling with appropriate min/max connections

2. **Cold Start Performance:**
   - **Risk:** Serverless functions may experience cold starts, affecting initial response times
   - **Mitigation:** Implement warming strategies or consider using Edge Functions for critical paths

3. **Storage Permissions:**
   - **Risk:** Incorrect Supabase Storage permissions could lead to security issues
   - **Mitigation:** Ensure proper bucket policies and use signed URLs with short expiration times

4. **Environment Variable Management:**
   - **Risk:** Missing or incorrect environment variables in production
   - **Mitigation:** Use a checklist and verify all variables are set before final deployment

5. **Session Management:**
   - **Risk:** Session management might behave differently in serverless environments
   - **Mitigation:** Test session persistence thoroughly and adjust cookie settings if needed

## Post-Deployment Verification

After deployment, verify the following:

1. **User Authentication:** Test registration and login functionality
2. **Database Operations:** Verify CRUD operations for trips and expenses
3. **File Uploads:** Test receipt upload and retrieval
4. **OCR Functionality:** Test OCR with different receipt formats
5. **Security Headers:** Verify security headers are properly set
6. **Performance:** Check load times and responsiveness

## Monitoring and Maintenance

1. **Set up Error Monitoring:**
   - Consider integrating Sentry or similar error tracking service

2. **Performance Monitoring:**
   - Use Vercel Analytics to monitor performance

3. **Regular Backups:**
   - Set up regular database backups in Supabase

4. **Update Dependencies:**
   - Establish a schedule for updating dependencies
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: ".env.local" });

// Get Supabase URL and key from environment variables
const getSupabaseConfig = () => {
  // First try to use SUPABASE_URL directly if available
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
  
  // Validate required environment variables
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is not set');
  }
  
  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_KEY environment variable is not set');
  }
  
  console.log(`Using Supabase URL: ${supabaseUrl}`);
  return { supabaseUrl, supabaseKey };
};

export class SupabaseStorageService {
  private supabase;
  private bucketName = 'expense-receipts';
  
  constructor() {
    const { supabaseUrl, supabaseKey } = getSupabaseConfig();
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
export const storageService = SupabaseStorageService.prototype.initialize.call(new SupabaseStorageService());
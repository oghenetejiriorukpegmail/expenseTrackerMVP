import { storageService } from './supabase-storage';
import fs from 'fs';
import path from 'path';
import { Request } from 'express';

// Define request type with file from multer
export interface MulterRequest extends Request {
  file?: any;
  files?: any[];
}

export class FileHandler {
  /**
   * Uploads a file to Supabase Storage
   * @param req The request object containing the file and user
   * @returns The storage path of the uploaded file
   */
  static async uploadFile(req: MulterRequest): Promise<string | null> {
    if (!req.file || !req.user) {
      return null;
    }

    try {
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

      return storagePath;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Gets a signed URL for a file in Supabase Storage
   * @param storagePath The storage path of the file
   * @returns A signed URL for the file
   */
  static async getFileUrl(storagePath: string): Promise<string> {
    try {
      return await (await storageService).getFileUrl(storagePath);
    } catch (error) {
      console.error('Error getting file URL:', error);
      throw error;
    }
  }

  /**
   * Deletes a file from Supabase Storage
   * @param storagePath The storage path of the file
   */
  static async deleteFile(storagePath: string): Promise<void> {
    try {
      await (await storageService).deleteFile(storagePath);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Handles file upload for expense creation/update
   * @param req The request object containing the file and user
   * @param oldReceiptPath The old receipt path (for updates)
   * @returns The storage path of the uploaded file
   */
  static async handleExpenseFileUpload(req: MulterRequest, oldReceiptPath?: string | null): Promise<string | null> {
    // If no new file was uploaded, return the old path
    if (!req.file) {
      return oldReceiptPath || null;
    }

    try {
      // If updating and there's an old receipt, delete it
      if (oldReceiptPath) {
        await FileHandler.deleteFile(oldReceiptPath).catch(err => {
          console.warn(`Failed to delete old receipt: ${oldReceiptPath}`, err);
        });
      }

      // Upload the new file
      return await FileHandler.uploadFile(req);
    } catch (error) {
      console.error('Error handling expense file upload:', error);
      throw error;
    }
  }
}
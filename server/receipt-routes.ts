import express, { Router } from 'express';
import { FileHandler } from './file-handler';
import { IStorage } from './storage';

/**
 * Creates and registers receipt-related routes
 * @param router The Express router to register routes on
 * @param storage The storage instance
 */
export function registerReceiptRoutes(router: Router, storage: IStorage): void {
  // Get a signed URL for a receipt
  router.get('/api/expenses/receipt/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const expenseId = parseInt(req.params.id);
      if (isNaN(expenseId)) {
        return res.status(400).json({ message: 'Invalid expense ID' });
      }
      
      const expense = await storage.getExpense(expenseId);
      
      if (!expense) {
        return res.status(404).json({ message: 'Expense not found' });
      }
      
      if (expense.userId !== req.user!.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      if (!expense.receiptPath) {
        return res.status(404).json({ message: 'No receipt attached to this expense' });
      }
      
      // Get a signed URL from Supabase
      const signedUrl = await FileHandler.getFileUrl(expense.receiptPath);
      
      res.json({ url: signedUrl });
    } catch (error) {
      console.error('Error getting receipt URL:', error);
      next(error);
    }
  });

  // Upload a receipt (standalone endpoint)
  router.post('/api/expenses/upload', express.raw({ type: 'multipart/form-data', limit: '10mb' }), async (req: any, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      // Upload to Supabase Storage
      const storagePath = await FileHandler.uploadFile(req);
      
      if (!storagePath) {
        return res.status(500).json({ message: 'Failed to upload file' });
      }
      
      // Return the storage path to be saved in the database
      res.json({ 
        message: 'File uploaded successfully',
        receiptPath: storagePath
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      next(error);
    }
  });
}
import { apiRequest } from "./queryClient";

/**
 * Fetches a signed URL for a receipt
 * @param expenseId The ID of the expense
 * @returns A promise that resolves to the signed URL
 */
export async function getReceiptUrl(expenseId: number): Promise<string> {
  try {
    const response = await apiRequest("GET", `/api/expenses/receipt/${expenseId}`);
    return response.url;
  } catch (error) {
    console.error("Error fetching receipt URL:", error);
    throw new Error("Failed to fetch receipt URL");
  }
}

/**
 * Extracts the expense ID from a receipt path
 * @param receiptPath The receipt path (e.g., "user_1/1234567890_receipt.pdf" or legacy path)
 * @returns The expense ID or null if not found
 */
export function getExpenseIdFromReceiptPath(receiptPath: string): number | null {
  // Check if it's a legacy path (e.g., "/uploads/filename.pdf")
  if (receiptPath.startsWith("/uploads/")) {
    return null;
  }
  
  // For new paths, we need to extract the expense ID from the database
  return null;
}

/**
 * Determines if a receipt path is a legacy path
 * @param receiptPath The receipt path
 * @returns True if the path is a legacy path
 */
export function isLegacyReceiptPath(receiptPath: string): boolean {
  return receiptPath.startsWith("/uploads/");
}
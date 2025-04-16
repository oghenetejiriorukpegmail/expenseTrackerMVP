import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useModalStore } from "@/lib/store";
import { useState, useEffect } from "react";
import { X, ZoomIn, ZoomOut, Download, Loader2 } from "lucide-react";
import { getReceiptUrl, isLegacyReceiptPath } from "@/lib/receipt-service";

export default function ReceiptViewerModal() {
  const { receiptViewerOpen: open, closeReceiptViewer, currentReceiptUrl: initialUrl } = useModalStore();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentReceiptUrl, setCurrentReceiptUrl] = useState<string | null>(null);

  // Fetch the signed URL if needed
  useEffect(() => {
    async function fetchSignedUrl() {
      if (!initialUrl) {
        setCurrentReceiptUrl(null);
        return;
      }

      // If it's a legacy path (starts with /uploads/), we need to extract the expense ID
      if (isLegacyReceiptPath(initialUrl)) {
        // For backward compatibility, use the initialUrl directly
        setCurrentReceiptUrl(initialUrl);
        return;
      }

      // If it's a numeric ID, fetch the signed URL
      const expenseId = parseInt(initialUrl);
      if (!isNaN(expenseId)) {
        try {
          setLoading(true);
          setError(null);
          const signedUrl = await getReceiptUrl(expenseId);
          setCurrentReceiptUrl(signedUrl);
        } catch (error) {
          console.error("Error fetching receipt URL:", error);
          setError("Failed to load receipt. Please try again later.");
          setCurrentReceiptUrl(null);
        } finally {
          setLoading(false);
        }
      } else {
        // If it's not a legacy path or a numeric ID, assume it's already a signed URL
        setCurrentReceiptUrl(initialUrl);
      }
    }

    fetchSignedUrl();
  }, [initialUrl]);
  
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };
  
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };
  
  const handleDownload = () => {
    if (!currentReceiptUrl) return;
    
    const link = document.createElement('a');
    link.href = currentReceiptUrl;
    link.download = currentReceiptUrl.split('/').pop() || 'receipt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleImageLoad = () => {
    setIsImageLoaded(true);
    setError(null);
  };
  
  const handleImageError = () => {
    setIsImageLoaded(false);
    setError("Failed to load receipt image. The file may be corrupted or unavailable.");
  };
  
  return (
    <Dialog open={open} onOpenChange={closeReceiptViewer}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Receipt Viewer</DialogTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={zoomLevel <= 0.5}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm">{Math.round(zoomLevel * 100)}%</span>
            <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={zoomLevel >= 3}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleDownload} disabled={!isImageLoaded}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={closeReceiptViewer}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-grow overflow-auto flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-md p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm">Loading receipt...</p>
            </div>
          ) : currentReceiptUrl ? (
            error ? (
              <div className="text-center text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p>{error}</p>
              </div>
            ) : (
              (() => {
                const isPdf = currentReceiptUrl.toLowerCase().endsWith('.pdf');
                if (isPdf) {
                  // Render PDF using embed or iframe
                  return (
                    <iframe
                      src={currentReceiptUrl}
                      title="Receipt PDF"
                      className="w-full h-full border-0"
                      onLoad={() => { setIsImageLoaded(true); setError(null); }} // Treat PDF load as success
                      onError={handleImageError} // Use same error handler
                    />
                    // Alternative: <embed src={currentReceiptUrl} type="application/pdf" className="w-full h-full" />
                  );
                } else {
                  // Render Image
                  return (
                    <div
                      style={{
                        transform: `scale(${zoomLevel})`,
                        transition: 'transform 0.2s ease'
                      }}
                      className="transform-origin-center"
                    >
                      <img
                        src={currentReceiptUrl}
                        alt="Receipt"
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                        className="max-h-full object-contain"
                      />
                    </div>
                  );
                }
              })()
            )
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400">
              No receipt selected
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

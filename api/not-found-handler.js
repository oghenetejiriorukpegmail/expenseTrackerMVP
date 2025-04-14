// Middleware to detect and log 404 errors in the API
export function setupNotFoundHandler(app) {
  // This should be added after all routes are registered
  app.use((req, res, next) => {
    // Skip static files and already responded requests
    if (res.headersSent) {
      return next();
    }

    // Log detailed information about the 404
    console.error(
      `[404 ERROR] Path: ${req.path}, Method: ${req.method}, Query: ${JSON.stringify(
        req.query
      )}, Headers: ${JSON.stringify(req.headers)}`
    );

    // Return a standardized 404 response
    return res.status(404).json({
      error: "Not Found",
      message: `The requested resource '${req.path}' was not found.`,
      code: "RESOURCE_NOT_FOUND"
    });
  });

  return app;
}
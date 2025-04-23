#!/bin/bash

# This script automates recurring deployment steps on the Ubuntu server.
# It assumes the built application files (the 'dist' directory) have already been transferred to the server.

# --- Configuration ---
# Set the path to your application's root directory on the server
APP_DIR="/path/to/your/server/destination/expenseTrackerMVP"

# Set the name of your PM2 process for the backend
PM2_PROCESS_NAME="expense-tracker-backend"

# --- Deployment Steps ---

echo "Navigating to application directory: $APP_DIR"
cd "$APP_DIR" || { echo "Error: Could not navigate to $APP_DIR. Exiting."; exit 1; }

echo "Installing/updating production dependencies..."
npm install --production || { echo "Error: Failed to install production dependencies. Exiting."; exit 1; }

echo "Restarting PM2 process: $PM2_PROCESS_NAME"
pm2 restart "$PM2_PROCESS_NAME" || { echo "Error: Failed to restart PM2 process $PM2_PROCESS_NAME. Ensure PM2 is running and the process name is correct. Exiting."; exit 1; }

echo "Deployment automation script finished."

# Note: Initial server setup (Node.js, npm, PM2, Nginx, Certbot) is not included in this script
# and should be performed separately as outlined in Production_server.md.
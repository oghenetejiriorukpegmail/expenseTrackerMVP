r# Hosting the Expense Tracker Application on an Ubuntu Server

This document outlines the general steps to host the built Expense Tracker application on an Ubuntu server. The application consists of a static frontend (in `dist/public`) and a Node.js backend (in `dist`).

## Prerequisites

*   An Ubuntu server with SSH access.
*   Node.js and npm installed on the server.
*   A domain name pointing to your server's IP address (optional, but recommended for production).

## Steps

1.  **Transfer Built Application Files**

    After successfully building the application (which generates the `dist` directory), transfer the entire `dist` directory to your Ubuntu server. You can use `scp` or `rsync` for this.

    Using `scp`:
    ```bash
    scp -r /path/to/your/local/expenseTrackerMVP/dist user@your_server_ip:/path/to/your/server/destination
    ```

    Using `rsync`:
    ```bash
    rsync -avz /path/to/your/local/expenseTrackerMVP/dist user@your_server_ip:/path/to/your/server/destination
    ```

2.  **Set Up the Server Environment**

    Ensure Node.js and npm are installed on your Ubuntu server.

    ```bash
    sudo apt update
    sudo apt install nodejs npm
    ```

    Consider using NVM (Node Version Manager) for easier Node.js version management:
    ```bash
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
    # Close and reopen your terminal, then install a Node.js version
    nvm install node
    ```

3.  **Install Production Dependencies**

    Navigate to the application's root directory on the server (where you placed the `dist` folder). Install only the production dependencies for the backend:

    ```bash
    cd /path/to/your/server/destination/expenseTrackerMVP # Adjust path as needed
    npm install --production
    ```

4.  **Run the Backend Server with PM2**

    Use PM2 to manage your Node.js backend process.

    Install PM2 globally:
    ```bash
    sudo npm install -g pm2
    ```

    Start your backend server (assuming your start script is `node dist/index.js`):
    ```bash
    pm2 start dist/index.js --name expense-tracker-backend
    ```

    Configure PM2 to start on boot:
    ```bash
    pm2 startup systemd
    pm2 save
    ```

    Useful PM2 commands:
    *   `pm2 status`: Check the status of your processes.
    *   `pm2 logs expense-tracker-backend`: View logs for your application.
    *   `pm2 restart expense-tracker-backend`: Restart the application.

5.  **Serve Frontend Static Files with Nginx**

    Install Nginx to serve your static frontend files and act as a reverse proxy for the backend API.

    Install Nginx:
    ```bash
    sudo apt install nginx
    ```

    Create a new Nginx configuration file for your site (e.g., `/etc/nginx/sites-available/expense-tracker`):

    ```nginx
    server {
        listen 80;
        server_name your_domain_or_server_ip; # Replace with your domain or IP

        location / {
            root /path/to/your/server/destination/expenseTrackerMVP/dist/public; # Path to your static files
            try_files $uri $uri/ /index.html;
        }

        location /api/ { # Adjust if your API endpoints have a different base path
            proxy_pass http://localhost:3000; # Adjust if your Node.js server runs on a different port
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```

    Create a symbolic link to enable the configuration and remove the default Nginx site:

    ```bash
    sudo ln -s /etc/nginx/sites-available/expense-tracker /etc/nginx/sites-enabled/
    sudo unlink /etc/nginx/sites-enabled/default
    ```

    Test the Nginx configuration and reload Nginx:

    ```bash
    sudo nginx -t
    sudo systemctl reload nginx
    ```

6.  **Set Up SSL/TLS with Certbot (Recommended)**

    Secure your application with HTTPS using Certbot and Let's Encrypt.

    Install Certbot and the Nginx plugin:
    ```bash
    sudo apt install certbot python3-certbot-nginx
    ```

    Run Certbot to obtain and install a certificate:
    ```bash
    sudo certbot --nginx -d your_domain_or_server_ip # Replace with your domain or IP
    ```

    Certbot will guide you through the process and automatically configure Nginx for HTTPS.

Following these steps should allow you to host your built Expense Tracker application on an Ubuntu server. Remember to replace placeholder paths and domain/IP addresses with your actual server details.
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('Testing build process...');

try {
  // Run the prebuild script
  console.log('Running prebuild script...');
  execSync('node scripts/prepare-build.js', { stdio: 'inherit', cwd: rootDir });
  
  // Run the build command
  console.log('Running build command...');
  execSync('npx vite build --emptyOutDir', {
    stdio: 'inherit',
    cwd: rootDir,
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  // Check if the build was successful
  const distDir = path.join(rootDir, 'dist');
  if (fs.existsSync(distDir)) {
    console.log('Build successful! Output directory exists.');
    
    // List the contents of the dist directory
    const distFiles = fs.readdirSync(distDir, { withFileTypes: true });
    console.log('Contents of dist directory:');
    distFiles.forEach(file => {
      console.log(`- ${file.isDirectory() ? '[DIR]' : '[FILE]'} ${file.name}`);
    });
    
    // Check for index.html in dist/public
    const publicDir = path.join(distDir, 'public');
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      console.log('index.html exists in the dist/public directory.');
      
      // Check the size of index.html
      const stats = fs.statSync(indexPath);
      console.log(`index.html size: ${stats.size} bytes`);
    } else {
      console.log('WARNING: index.html does not exist in the dist/public directory.');
    }
  } else {
    console.log('Build failed! Output directory does not exist.');
  }
  
  console.log('Test build completed.');
} catch (error) {
  console.error('Error during test build:', error.message);
  process.exit(1);
}
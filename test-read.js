import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.resolve(__dirname, 'client/index.html');
console.log('File path:', filePath);

try {
  const stats = fs.statSync(filePath);
  console.log('File stats:', stats);
  console.log('Is file:', stats.isFile());
  console.log('Is directory:', stats.isDirectory());
  
  if (stats.isFile()) {
    const content = fs.readFileSync(filePath, 'utf8');
    console.log('File content length:', content.length);
    console.log('First 100 characters:', content.substring(0, 100));
  }
} catch (error) {
  console.error('Error:', error);
}
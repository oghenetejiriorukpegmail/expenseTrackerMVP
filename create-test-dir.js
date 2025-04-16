import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testDir = path.resolve(__dirname, 'minimal-test');
const indexHtmlPath = path.resolve(testDir, 'index.html');

// Create directory if it doesn't exist
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
  console.log(`Created directory: ${testDir}`);
}

// Create a minimal index.html file
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Minimal Test</title>
</head>
<body>
  <div id="app"></div>
</body>
</html>
`;

fs.writeFileSync(indexHtmlPath, htmlContent);
console.log(`Created file: ${indexHtmlPath}`);

// Verify the file exists and is readable
const stats = fs.statSync(indexHtmlPath);
console.log('File stats:', {
  isFile: stats.isFile(),
  isDirectory: stats.isDirectory(),
  size: stats.size
});
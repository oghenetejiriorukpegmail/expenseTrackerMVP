import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('Preparing build environment...');

// Create src directory in minimal-test if it doesn't exist
const minimalTestSrcDir = path.join(rootDir, 'minimal-test', 'src');
if (!fs.existsSync(minimalTestSrcDir)) {
  fs.mkdirSync(minimalTestSrcDir, { recursive: true });
  console.log('Created minimal-test/src directory');
}

// Copy main.tsx from client/src to minimal-test/src
const clientMainPath = path.join(rootDir, 'client', 'src', 'main.tsx');
const minimalTestMainPath = path.join(minimalTestSrcDir, 'main.tsx');

if (fs.existsSync(clientMainPath)) {
  fs.copyFileSync(clientMainPath, minimalTestMainPath);
  console.log('Copied main.tsx to minimal-test/src');
} else {
  console.error('Error: client/src/main.tsx not found');
  process.exit(1);
}

// Create a simple App.tsx in minimal-test/src
const appContent = `
import React from 'react';

export default function App() {
  return (
    <div className="app">
      <h1>Expense Tracker</h1>
      <p>Minimal test build</p>
    </div>
  );
}
`;

fs.writeFileSync(path.join(minimalTestSrcDir, 'App.tsx'), appContent);
console.log('Created minimal-test/src/App.tsx');

// Create a simple index.css in minimal-test/src
const cssContent = `
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

.app {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}
`;

fs.writeFileSync(path.join(minimalTestSrcDir, 'index.css'), cssContent);
console.log('Created minimal-test/src/index.css');

console.log('Build environment prepared successfully');
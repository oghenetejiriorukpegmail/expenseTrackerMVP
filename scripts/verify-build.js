import fs from 'fs';
import path from 'path';

// Paths to check
const requiredPaths = [
  // Static assets
  'dist/public',
  'dist/public/index.html',
  'dist/public/assets',
  
  // API function
  'api/index.js',
  
  // Essential client files
  'client/index.html',
];

// Add debug logging for environment
console.log('Debug - Environment variables:');
console.log(`NODE_ENV=${process.env.NODE_ENV || 'not set'}`);
console.log(`Current working directory: ${process.cwd()}`);

// Check if a path is a directory when it should be a file, or vice versa
function checkPathType(pathToCheck, expectedType) {
  try {
    const fullPath = path.resolve(process.cwd(), pathToCheck);
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ ${pathToCheck} does not exist`);
      return false;
    }
    
    const stats = fs.statSync(fullPath);
    const isDirectory = stats.isDirectory();
    
    if (expectedType === 'file' && isDirectory) {
      console.log(`❌ ${pathToCheck} is a directory but should be a file!`);
      return false;
    }
    
    if (expectedType === 'directory' && !isDirectory) {
      console.log(`❌ ${pathToCheck} is a file but should be a directory!`);
      return false;
    }
    
    console.log(`✅ ${pathToCheck} is correctly a ${expectedType}`);
    return true;
  } catch (error) {
    console.log(`❌ Error checking ${pathToCheck}: ${error.message}`);
    return false;
  }
}

// Files to check for content
const contentChecks = [
  {
    path: 'dist/public/index.html',
    patterns: [
      '<div id="root">'
    ]
  }
];

console.log('🔍 Verifying build output...');

// Check required paths
let allPathsExist = true;
for (const reqPath of requiredPaths) {
  const fullPath = path.resolve(process.cwd(), reqPath);
  const exists = fs.existsSync(fullPath);
  
  console.log(`${exists ? '✅' : '❌'} ${reqPath}`);
  
  if (!exists) {
    allPathsExist = false;
  }
}

// Check file contents
let allContentValid = true;
for (const check of contentChecks) {
  const fullPath = path.resolve(process.cwd(), check.path);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ Content check for ${check.path} - File doesn't exist!`);
    allContentValid = false;
    continue;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  let allPatternsFound = true;
  
  for (const pattern of check.patterns) {
    const found = content.includes(pattern);
    console.log(`${found ? '✅' : '❌'} ${check.path} - Pattern: "${pattern}"`);
    
    if (!found) {
      allPatternsFound = false;
    }
  }
  
  if (!allPatternsFound) {
    allContentValid = false;
  }
}

// Print directory structure for reference
console.log('\n📁 Generated directory structure:');
function listDirRecursive(dir, indent = '') {
  if (!fs.existsSync(dir)) return;
  
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    if (item.name.startsWith('node_modules') || item.name.startsWith('.git')) continue;
    
    console.log(`${indent}${item.isDirectory() ? '📁' : '📄'} ${item.name}`);
    
    if (item.isDirectory()) {
      listDirRecursive(path.join(dir, item.name), indent + '  ');
    }
  }
}

listDirRecursive('./dist', '  ');
console.log('  📁 api');
listDirRecursive('./api', '    ');

// Additional type checks for critical paths
console.log('\n🔍 Verifying file and directory types...');
const criticalPathTypes = [
  { path: 'client/index.html', type: 'file' },
  { path: 'client', type: 'directory' },
  { path: 'dist/public', type: 'directory' },
];

// Add detailed filesystem debug info
console.log('\n📋 Detailed filesystem state:');
try {
  // Check client directory
  console.log('Client directory contents:');
  const clientDir = path.resolve(process.cwd(), 'client');
  if (fs.existsSync(clientDir)) {
    const clientFiles = fs.readdirSync(clientDir);
    console.log(`Client files: ${JSON.stringify(clientFiles)}`);
  } else {
    console.log('Client directory does not exist!');
  }
  
  // Check client/index.html
  const clientIndex = path.resolve(clientDir, 'index.html');
  if (fs.existsSync(clientIndex)) {
    const stats = fs.statSync(clientIndex);
    console.log(`client/index.html stats: ${JSON.stringify(stats)}`);
    console.log(`File size: ${stats.size} bytes`);
  } else {
    console.log('client/index.html does not exist!');
  }
  
  // Check dist/public directory
  const distPublic = path.resolve(process.cwd(), 'dist', 'public');
  if (fs.existsSync(distPublic)) {
    const distFiles = fs.readdirSync(distPublic);
    console.log(`dist/public files: ${JSON.stringify(distFiles)}`);
  } else {
    console.log('dist/public directory does not exist!');
  }
} catch (error) {
  console.log(`Error during detailed filesystem check: ${error.message}`);
}

let allTypesCorrect = true;
for (const { path: checkPath, type } of criticalPathTypes) {
  // Only check if the path exists
  if (fs.existsSync(path.resolve(process.cwd(), checkPath))) {
    const typeCorrect = checkPathType(checkPath, type);
    if (!typeCorrect) {
      allTypesCorrect = false;
    }
  }
}

// Final result
if (allPathsExist && allContentValid && allTypesCorrect) {
  console.log('\n✅ Build verification passed! Ready for deployment.');
  process.exit(0);
} else {
  console.log('\n❌ Build verification failed! Please check the issues above.');
  process.exit(1);
}
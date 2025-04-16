import { build } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runBuild() {
  try {
    console.log('Starting Vite build...');
    
    const result = await build({
      root: path.resolve(__dirname, 'minimal-test'),
      build: {
        outDir: path.resolve(__dirname, 'minimal-dist'),
        emptyOutDir: true
      },
      logLevel: 'info'
    });
    
    console.log('Build completed successfully:', result);
  } catch (error) {
    console.error('Build failed:', error);
  }
}

runBuild();
// Copy worker file to dist after build
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const srcWorker = join(__dirname, 'high-tree-worker.js');
const distDir = join(__dirname, 'dist');
const destWorker = join(distDir, 'high-tree-worker.js');

// Ensure dist directory exists
if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
}

// Copy worker file
try {
    copyFileSync(srcWorker, destWorker);
    console.log('✅ Worker file copied to dist/');
} catch (error) {
    console.error('❌ Failed to copy worker file:', error.message);
    process.exit(1);
}

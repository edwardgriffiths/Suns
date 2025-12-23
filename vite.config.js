import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

// Automatically find all HTML files in the directory to link them for the build
const htmlFiles = fs.readdirSync(__dirname)
    .filter(file => file.endsWith('.html'))
    .reduce((acc, file) => {
        const name = file.replace('.html', '');
        acc[name] = resolve(__dirname, file);
        return acc;
    }, {});

export default defineConfig({
    build: {
        rollupOptions: {
            input: htmlFiles
        }
    },
    server: {
        open: true // Auto-open browser on start
    }
});

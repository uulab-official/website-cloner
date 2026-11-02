import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { renderPage } from './src/render.js';
import { demoBuildPolicy } from './build-policy.mjs';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: ['terminal.local'],
  },
  plugins: [demoBuildPolicy(fileURLToPath(new URL('.', import.meta.url))), {
    name: 'uulab-static-content',
    // Rendering at build/dev-server time keeps all content, links and native
    // FAQ controls usable when JavaScript is disabled in the browser.
    transformIndexHtml(html) {
      return html.replace('<!-- uulab:page -->', renderPage());
    },
  }],
  build: {
    outDir: fileURLToPath(new URL('../../dist/demo', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        services: fileURLToPath(new URL('./services/index.html', import.meta.url)),
      },
    },
  },
});

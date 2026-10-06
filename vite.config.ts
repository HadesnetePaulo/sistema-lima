import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'silence-hmr',
        transformIndexHtml: {
          order: 'post',
          handler(html) {
            const match = html.match(/<script>[\s\S]*?\/\/ Suppress Vite HMR WebSocket[\s\S]*?<\/script>/i);
            if (match) {
              const script = match[0];
              return html.replace(script, '').replace(/<head[^>]*>/i, `$&\n    ${script}`);
            }
            return html;
          },
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

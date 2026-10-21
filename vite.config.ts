/// <reference types="vitest" />
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * AdSense is a site-level, build-time decision: the block between `<!-- ads:start` and
 * `<!-- ads:end -->` in index.html is stripped unless the build runs with VITE_ADS=on.
 * Default (and production) is off. See DEPLOY.md for why this is not a runtime toggle.
 */
function adsBuildFlag(adsOn: boolean): Plugin {
  return {
    name: 'gab-guide-ads-build-flag',
    transformIndexHtml(html) {
      if (adsOn) return html;
      return html.replace(/[ \t]*<!-- ads:start[\s\S]*?<!-- ads:end -->[ \t]*\r?\n?/g, '');
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const adsOn = (process.env.VITE_ADS ?? env.VITE_ADS) === 'on';
  return {
    base: '/',
    server: {
      port: 3002,
      host: '0.0.0.0',
    },
    plugins: [react(), tailwindcss(), adsBuildFlag(adsOn)],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    },
  };
});

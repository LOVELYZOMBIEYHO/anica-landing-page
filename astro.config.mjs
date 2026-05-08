import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

const fromRoot = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  site: 'https://lovelyzombieyho.github.io',
  base: '/anica-landing-page',
  trailingSlash: 'ignore',
  vite: {
    resolve: {
      alias: {
        '@components': fromRoot('./src/components'),
        '@data': fromRoot('./src/data'),
        '@layouts': fromRoot('./src/layouts'),
        '@styles': fromRoot('./src/styles'),
        '@utils': fromRoot('./src/utils'),
      },
    },
  },
});

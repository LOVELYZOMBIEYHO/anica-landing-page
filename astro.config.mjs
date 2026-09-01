import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

const fromRoot = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  site: 'https://lovelyzombieyho.github.io',
  base: '/anica-landing-page',
  trailingSlash: 'ignore',
  // The playground supplies its own diagnostics. Astro's development toolbar
  // can return a transient "Outdated Optimize Dep" 504 while Vite refreshes
  // dependencies, which must not interfere with Action Editor startup.
  devToolbar: { enabled: false },
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

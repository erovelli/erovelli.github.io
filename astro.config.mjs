// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://erovel.li',
  output: 'static',
  integrations: [sitemap()],
});

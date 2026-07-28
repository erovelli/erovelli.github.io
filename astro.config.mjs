// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://erovel.li',
  output: 'static',
  /*
    Explicit rather than inherited. Every internal href in this repo ends in a
    slash and the build emits directory-style routes, so `/about` and `/about/`
    would otherwise both resolve — two URLs for one page, splitting whatever
    ranking signal each accumulates. Pinning it makes a mismatched link a dev
    server 404 instead of a silent duplicate.
  */
  trailingSlash: 'always',
  integrations: [sitemap()],
});

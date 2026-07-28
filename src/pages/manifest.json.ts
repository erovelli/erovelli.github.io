import type { APIRoute } from 'astro';
import { site } from '../config';

/**
 * Web app manifest, generated so the name and colours cannot drift from
 * site.config.json.
 *
 * Served as `manifest.json` rather than the more conventional
 * `site.webmanifest`: static hosts decide Content-Type by extension, and
 * `.webmanifest` is not reliably mapped to `application/manifest+json`
 * everywhere. `application/json` is always accepted for a manifest.
 */
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        name: site.name,
        short_name: site.name,
        description: site.description,
        start_url: '/',
        display: 'browser',
        background_color: '#f4f2ec',
        theme_color: '#f4f2ec',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/favicon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json' } },
  );

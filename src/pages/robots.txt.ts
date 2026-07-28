import type { APIRoute } from 'astro';
import { site } from '../config';

/**
 * Kept as an endpoint rather than a static file in public/ so the sitemap URL is
 * derived from site.config.json. A hardcoded public/robots.txt would be a second
 * place the domain has to be updated.
 */
export const GET: APIRoute = () =>
  new Response(
    [
      'User-agent: *',
      'Allow: /',
      `Sitemap: ${site.url}/sitemap-index.xml`,
      '',
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );

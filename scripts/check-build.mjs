/**
 * Post-build verification for the generated site in `dist/`.
 *
 * `astro check` validates types and `prettier` validates formatting; neither
 * notices a dead internal link, a missing favicon, a page with no description,
 * or a heading outline that skips a level. Every defect this script checks for
 * was present in the first version of this site and passed all other gates.
 *
 * Deliberately dependency-free and offline: it parses only HTML this repo
 * generated, so tolerant regex matching is sufficient, and it never touches the
 * network, so CI cannot fail because someone else's server was down.
 *
 * Run via `npm run validate`, or on its own after a build:
 *
 *     npm run build && npm run check:build
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import site from '../site.config.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

/** Meta descriptions much beyond this are truncated in search results. */
const DESCRIPTION_MAX = 160;

/** Assets that must exist because the layout hardcodes a reference to them. */
const REQUIRED_ASSETS = [
  'favicon.svg',
  'favicon-32.png',
  'favicon-192.png',
  'favicon-512.png',
  'apple-touch-icon.png',
  'og.png',
  'manifest.json',
  'robots.txt',
  'sitemap-index.xml',
  'fonts/inter-latin.woff2',
  'fonts/inter-latin-ext.woff2',
];

const problems = [];
const fail = (file, message) => problems.push({ file, message });

const exists = async (absolute) =>
  stat(absolute).then(
    (s) => s.isFile(),
    () => false,
  );

async function walk(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(absolute)));
    else found.push(absolute);
  }
  return found;
}

/* ------------------------------------------------------------------ parse --- */

const attr = (tag, name) => {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'),
  );
  return match ? (match[2] ?? match[3] ?? '') : null;
};

const tags = (html, name) =>
  html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];

/** Returns the content attribute of the first matching meta tag. */
function meta(html, key) {
  for (const tag of tags(html, 'meta')) {
    const id = attr(tag, 'name') ?? attr(tag, 'property');
    if (id?.toLowerCase() === key) return attr(tag, 'content');
  }
  return null;
}

/** Returns hrefs of all <link> tags whose rel contains the given token. */
function links(html, rel) {
  return tags(html, 'link')
    .filter((tag) =>
      (attr(tag, 'rel') ?? '')
        .toLowerCase()
        .split(/\s+/)
        .includes(rel.toLowerCase()),
    )
    .map((tag) => attr(tag, 'href'))
    .filter((href) => href !== null);
}

/* ------------------------------------------------------------------ links --- */

/**
 * Maps an href found on `pageFile` to the file it should resolve to inside
 * dist, or null when the link is not ours to verify.
 */
function resolveTarget(href, pageFile) {
  const clean = href.split('#')[0].split('?')[0];
  if (!clean) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) return null; // http:, mailto:, tel:
  if (clean.startsWith('//')) return null;

  const fromRoot = clean.startsWith('/');
  const base = fromRoot ? dist : path.dirname(pageFile);
  const target = path.resolve(base, fromRoot ? `.${clean}` : clean);

  // Directory-style URLs, which is Astro's default build format.
  if (clean.endsWith('/')) return [path.join(target, 'index.html')];
  if (path.extname(target)) return [target];
  // Extensionless: either a directory route or a bare .html file.
  return [path.join(target, 'index.html'), `${target}.html`];
}

/* --------------------------------------------------------------- canonical --- */

/**
 * The URL a page should name as its own canonical, derived from where it landed
 * in dist. A canonical pointing anywhere else tells search engines to index a
 * different page than the one they fetched.
 *
 * Returns null for routes that are not directory-style, i.e. the 404, which is
 * served for arbitrary paths and so has no single URL of its own.
 */
function expectedCanonical(file) {
  const rel = path.relative(dist, file).split(path.sep).join('/');
  if (!rel.endsWith('index.html')) return null;
  return `${site.url}/${rel.slice(0, -'index.html'.length)}`;
}

/* ----------------------------------------------------------------- markup --- */

/** Elements that never have a closing tag, so they never open a nesting level. */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

/** Tag names of the direct children of a fragment of HTML. */
function directChildren(inner) {
  const names = [];
  let depth = 0;

  for (const [, closing, name, rest] of inner.matchAll(
    /<(\/?)([a-z0-9-]+)\b([^>]*)>/gi,
  )) {
    const tag = name.toLowerCase();
    if (closing) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0) names.push(tag);
    if (!VOID_ELEMENTS.has(tag) && !rest.trimEnd().endsWith('/')) depth += 1;
  }

  return names;
}

/**
 * A `<dl>` may contain only `<dt>`, `<dd>`, `<div>`, `<script>` and
 * `<template>`, and a `<div>` used as a wrapper may contain only `<dt>` and
 * `<dd>`. Putting anything else in one — a decorative icon, say — produces a
 * description list that assistive technology cannot pair up, which is what
 * Lighthouse's `definition-list` audit reports. Draw it with CSS instead.
 */
function checkDefinitionLists(html, rel) {
  for (const [, attributes, inner] of html.matchAll(
    /<dl\b([^>]*)>([\s\S]*?)<\/dl>/gi,
  )) {
    const label = attr(`<dl${attributes}>`, 'class') ?? '(no class)';

    for (const child of directChildren(inner)) {
      if (!['dt', 'dd', 'div', 'script', 'template'].includes(child)) {
        fail(rel, `<dl class="${label}"> has a <${child}> child`);
      }
    }

    for (const [, wrapper] of inner.matchAll(
      /<div\b[^>]*>([\s\S]*?)<\/div>/gi,
    )) {
      for (const child of directChildren(wrapper)) {
        if (!['dt', 'dd'].includes(child)) {
          fail(
            rel,
            `<dl class="${label}"> has a <div> wrapping a <${child}>, which must be only <dt>/<dd>`,
          );
        }
      }
    }
  }
}

/* -------------------------------------------------------------- structured --- */

/** Every JSON-LD block on the page, parsed. Unparseable blocks are reported. */
function structuredData(html, rel) {
  const blocks = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];

  const parsed = [];
  for (const [, body] of blocks) {
    try {
      parsed.push(JSON.parse(body));
    } catch (error) {
      fail(rel, `JSON-LD block does not parse: ${error.message}`);
    }
  }
  return parsed;
}

/* ------------------------------------------------------------------ pages --- */

/** description -> pages using it, for the duplicate check after the walk. */
const descriptions = new Map();

async function checkPage(file, html) {
  const rel = path.relative(dist, file);

  /* --- head essentials --- */

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  if (!title) fail(rel, 'missing or empty <title>');

  const description = meta(html, 'description');
  if (!description?.trim()) fail(rel, 'missing meta description');
  else if (description.length > DESCRIPTION_MAX) {
    fail(
      rel,
      `meta description is ${description.length} chars, over the ${DESCRIPTION_MAX} limit`,
    );
  } else {
    descriptions.set(description, [
      ...(descriptions.get(description) ?? []),
      rel,
    ]);
  }

  if (meta(html, 'author') !== site.name) {
    fail(rel, `meta author should be "${site.name}"`);
  }

  if (!/<html[^>]*\blang\s*=/i.test(html)) fail(rel, 'missing <html lang>');

  const [canonical] = links(html, 'canonical');
  const expected = expectedCanonical(file);
  if (!canonical) fail(rel, 'missing rel=canonical');
  else if (!canonical.startsWith(site.url)) {
    fail(rel, `canonical does not point at ${site.url}: ${canonical}`);
  } else if (expected && canonical !== expected) {
    fail(rel, `canonical is ${canonical}, should be ${expected}`);
  }

  if (links(html, 'icon').length === 0) fail(rel, 'no favicon link');

  /* --- structured data --- */

  const schemas = structuredData(html, rel);
  if (schemas.length === 0) fail(rel, 'no JSON-LD structured data');

  for (const schema of schemas) {
    if (schema['@context'] !== 'https://schema.org') {
      fail(
        rel,
        `JSON-LD block missing @context: ${JSON.stringify(schema['@type'] ?? schema)}`,
      );
    }
    if (!schema['@type']) fail(rel, 'JSON-LD block missing @type');
  }

  // The Person node is what merges the scattered profiles into one entity, so
  // every page carries it. Losing it site-wide is the expensive kind of typo.
  if (!schemas.some((schema) => schema['@type'] === 'Person')) {
    fail(rel, 'no Person JSON-LD');
  }

  /* --- social preview: the reason a pasted link renders as a blank card --- */

  for (const key of ['og:title', 'og:description', 'og:url', 'og:image']) {
    if (!meta(html, key)?.trim()) fail(rel, `missing ${key}`);
  }

  const ogImage = meta(html, 'og:image');
  if (ogImage) {
    if (!ogImage.startsWith('http')) {
      fail(rel, `og:image must be an absolute URL: ${ogImage}`);
    } else if (ogImage.startsWith(site.url)) {
      const asset = path.join(dist, ogImage.slice(site.url.length));
      if (!(await exists(asset)))
        fail(rel, `og:image file missing: ${ogImage}`);
    }
  }

  /* --- heading outline --- */

  const headings = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  const h1Count = headings.filter((level) => level === 1).length;
  if (h1Count !== 1) fail(rel, `expected exactly one h1, found ${h1Count}`);

  headings.forEach((level, index) => {
    if (index === 0) {
      if (level !== 1) fail(rel, `first heading is h${level}, should be h1`);
      return;
    }
    const previous = headings[index - 1];
    if (level > previous + 1) {
      fail(rel, `heading order jumps from h${previous} to h${level}`);
    }
  });

  /* --- markup that assistive technology has to be able to parse --- */

  checkDefinitionLists(html, rel);

  /* --- images --- */

  for (const tag of tags(html, 'img')) {
    if (attr(tag, 'alt') === null) {
      fail(rel, `<img> without alt: ${attr(tag, 'src') ?? '(no src)'}`);
    }
  }

  /* --- anchors --- */

  for (const tag of tags(html, 'a')) {
    const href = attr(tag, 'href');
    if (href === null || href.trim() === '') {
      fail(rel, '<a> without href');
      continue;
    }

    // A new tab without noopener/noreferrer hands the opener to the target.
    if (attr(tag, 'target') === '_blank') {
      const relTokens = (attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
      if (
        !relTokens.includes('noopener') &&
        !relTokens.includes('noreferrer')
      ) {
        fail(rel, `target=_blank without noopener/noreferrer: ${href}`);
      }
    }

    const candidates = resolveTarget(href, file);
    if (!candidates) continue;

    let resolved = false;
    for (const candidate of candidates) {
      if (await exists(candidate)) {
        resolved = true;
        break;
      }
    }
    if (!resolved) fail(rel, `dead internal link: ${href}`);
  }

  /* --- stylesheet, script and asset references --- */

  for (const href of links(html, 'stylesheet')) {
    const candidates = resolveTarget(href, file);
    if (candidates && !(await exists(candidates[0]))) {
      fail(rel, `missing stylesheet: ${href}`);
    }
  }

  for (const tag of [...tags(html, 'link'), ...tags(html, 'script')]) {
    const href = attr(tag, 'href') ?? attr(tag, 'src');
    if (!href) continue;
    const isPreload = (attr(tag, 'rel') ?? '') === 'preload';
    const isIcon = (attr(tag, 'rel') ?? '').includes('icon');
    if (!isPreload && !isIcon) continue;

    const candidates = resolveTarget(href, file);
    if (candidates && !(await exists(candidates[0]))) {
      fail(rel, `missing referenced asset: ${href}`);
    }
  }

  /* --- content that should never ship --- */

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  for (const marker of ['Lorem ipsum', 'TODO', 'FIXME', 'PLACEHOLDER']) {
    if (bodyText.includes(marker)) {
      fail(rel, `visible placeholder text: "${marker}"`);
    }
  }
}

/* ------------------------------------------------------------------- main --- */

async function main() {
  if (!(await stat(dist).catch(() => null))) {
    process.stderr.write('dist/ not found. Run `npm run build` first.\n');
    process.exit(1);
  }

  const files = await walk(dist);
  const pages = files.filter((file) => file.endsWith('.html'));

  if (pages.length === 0) {
    process.stderr.write('No HTML pages found in dist/.\n');
    process.exit(1);
  }

  for (const asset of REQUIRED_ASSETS) {
    if (!(await exists(path.join(dist, asset)))) {
      fail('dist/', `required asset missing: ${asset}`);
    }
  }

  for (const page of pages) {
    await checkPage(page, await readFile(page, 'utf8'));
  }

  /* Two pages sharing a description are two pages competing for one result.
     It is the default failure mode of a layout that supplies a fallback. */
  for (const [description, users] of descriptions) {
    if (users.length > 1) {
      fail(
        users[0],
        `meta description is shared with ${users.slice(1).join(', ')}: "${description}"`,
      );
    }
  }

  if (problems.length > 0) {
    const byFile = new Map();
    for (const { file, message } of problems) {
      byFile.set(file, [...(byFile.get(file) ?? []), message]);
    }

    process.stderr.write(
      `\nBuild verification failed: ${problems.length} problem(s) in ${byFile.size} file(s).\n\n`,
    );
    for (const [file, messages] of [...byFile].sort()) {
      process.stderr.write(`  ${file}\n`);
      for (const message of messages)
        process.stderr.write(`    - ${message}\n`);
    }
    process.stderr.write('\n');
    process.exit(1);
  }

  process.stdout.write(
    `Build verification passed: ${pages.length} pages, ${REQUIRED_ASSETS.length} required assets.\n`,
  );
}

await main();

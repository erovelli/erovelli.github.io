/**
 * Rasterises the brand assets the Astro pipeline cannot produce: PNG icons (for
 * platforms that still ignore SVG favicons) and the Open Graph card used in link
 * previews.
 *
 * Outputs are committed to `public/`. This is a regeneration tool, not a build
 * step, so `npm run build` never depends on a network fetch. Run it whenever the
 * brand or identity changes:
 *
 *     npm run assets
 *
 * Why the text is converted to paths rather than left as <text>: the librsvg
 * inside sharp ignores `font-family` outright — rendering "Inter", "Helvetica"
 * and a deliberately nonexistent family all produce byte-identical output. Any
 * <text> we emitted would silently render in whatever default that particular
 * sharp build carries, and would change between macOS and CI. Converting to
 * outlines with a pinned Inter removes font resolution from the pipeline
 * entirely, so the card is byte-identical everywhere.
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

// Same identity file src/config.ts reads, so the OG card cannot drift from what
// the pages say.
import site from '../site.config.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toolsDir = path.join(root, 'tools');
const fontDir = path.join(toolsDir, '.fonts');
const publicDir = path.join(root, 'public');

/** Version-locked font URLs so regeneration is reproducible. Inter is OFL-1.1. */
const FONTS = {
  regular: {
    file: 'Inter-Regular.ttf',
    url: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf',
  },
  semibold: {
    file: 'Inter-SemiBold.ttf',
    url: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf',
  },
};

/** Must stay in step with the light-theme tokens in src/styles/global.css. */
const palette = {
  ink: '#1a1b16',
  paper: '#f4f2ec',
  muted: '#55574e',
  border: '#cbc6b6',
  accent: '#a8341c',
};

/** Mirrors the light-theme header monogram in src/styles/global.css. */
const iconPalette = {
  canvas: '#f3f0e6',
  ink: '#151a16',
  rule: '#283229',
};

const ICON_SIZES = [
  { file: 'favicon-32.png', size: 32 },
  { file: 'favicon-192.png', size: 192 },
  { file: 'favicon-512.png', size: 512 },
];

/** iOS ignores SVG favicons and transparency, and applies its own mask. */
const APPLE_TOUCH_SIZE = 180;

const exists = (p) =>
  access(p).then(
    () => true,
    () => false,
  );

async function loadFonts() {
  await mkdir(fontDir, { recursive: true });
  const loaded = {};

  for (const [weight, { file, url }] of Object.entries(FONTS)) {
    const dest = path.join(fontDir, file);

    if (!(await exists(dest))) {
      process.stdout.write(`  fetching ${file}\n`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Could not fetch ${file}: HTTP ${response.status}`);
      }
      await writeFile(dest, Buffer.from(await response.arrayBuffer()));
    }

    const buffer = await readFile(dest);
    // Slice to the exact byte range: a Buffer may be a view into a larger pool,
    // and opentype needs the ArrayBuffer to contain only the font.
    loaded[weight] = opentype.parse(
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ),
    );
  }

  return loaded;
}

/**
 * Lays out a single line of text as SVG path data.
 *
 * Walks glyph by glyph rather than calling `font.getPath(string)`, because
 * opentype's string path applies GSUB features and throws on one of Inter's
 * `ccmp` lookups ("substFormat: 2 is not yet supported"). Per-glyph advance plus
 * explicit kerning gives the same result for Latin text without touching that
 * code path.
 *
 * @param tracking Extra letter-spacing in px; negative tightens.
 */
function line(font, text, x, baseline, size, tracking = 0) {
  const scale = size / font.unitsPerEm;
  const segments = [];
  let cursor = x;
  let previous = null;

  for (const character of [...text]) {
    const glyph = font.charToGlyph(character);
    if (previous) {
      cursor += (font.getKerningValue(previous, glyph) || 0) * scale;
    }
    segments.push(glyph.getPath(cursor, baseline, size).toPathData(2));
    cursor += glyph.advanceWidth * scale + tracking;
    previous = glyph;
  }

  return {
    // Trailing tracking is not part of the visible run.
    width: cursor - x - tracking,
    markup: `<path d="${segments.join(' ')}" />`,
  };
}

/** The mark, as inline SVG geometry. Mirrors tools/icon.svg. */
function mark(x, y) {
  return `<g transform="translate(${x}, ${y})">
    <rect width="64" height="64" fill="${iconPalette.canvas}" />
    <rect x="2" y="2" width="60" height="60" fill="none" stroke="${iconPalette.rule}" stroke-width="2" />
    <path fill="${iconPalette.ink}" stroke="${iconPalette.ink}" stroke-linejoin="round" stroke-width="1.1" d="M20.42 39H28.54V40.45H18.82V23.54H28.54V24.99H20.42V31.08H28.11V32.5H20.42ZM38.52 24.97H34.69V32.09H38.4Q40.29 32.09 41.29 31.18Q42.29 30.27 42.29 28.56Q42.29 26.83 41.31 25.9Q40.34 24.97 38.52 24.97ZM42.34 40.45L39.13 33.48H34.69V40.45H33.12V23.54H38.62Q41.04 23.54 42.46 24.88Q43.89 26.21 43.89 28.49Q43.89 30.15 43.01 31.41Q42.14 32.67 40.68 33.11L44.14 40.45Z" />
  </g>`;
}

/**
 * Open Graph card. 1200x630 is the ratio LinkedIn, Slack, iMessage and X all
 * accept without recropping. Typographic rather than illustrative so it stays
 * legible at the ~360px width feeds actually render it at.
 */
function ogCard(fonts) {
  const width = 1200;
  const height = 630;
  const pad = 84;

  const name = line(fonts.semibold, site.name, pad, 340, 112, -2.5);
  const role = line(
    fonts.regular,
    `${site.role} · ${site.locationShort}`,
    pad,
    402,
    38,
  );
  const domain = line(fonts.regular, site.domain, pad, height - pad, 30);

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${palette.paper}" />
  ${mark(pad, pad)}
  <g fill="${palette.ink}">${name.markup}</g>
  <g fill="${palette.muted}">${role.markup}</g>
  <rect x="${pad}" y="${height - pad - 58}" width="${width - pad * 2}" height="1" fill="${palette.border}" />
  <g fill="${palette.muted}">${domain.markup}</g>
</svg>`);
}

async function writeIcons(iconSvg) {
  for (const { file, size } of ICON_SIZES) {
    await sharp(iconSvg)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(publicDir, file));
    process.stdout.write(`  public/${file}\n`);
  }

  // Flatten onto the light canvas so iOS does not introduce a contrasting edge
  // when it applies its own icon mask.
  await sharp(iconSvg)
    .resize(APPLE_TOUCH_SIZE, APPLE_TOUCH_SIZE)
    .flatten({ background: iconPalette.canvas })
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  process.stdout.write('  public/apple-touch-icon.png\n');
}

async function main() {
  await mkdir(publicDir, { recursive: true });

  const fonts = await loadFonts();
  const iconSvg = await readFile(path.join(toolsDir, 'icon.svg'));

  // Ship the vector as the primary favicon so the mark stays sharp at any
  // density; the PNGs are fallbacks.
  await writeFile(path.join(publicDir, 'favicon.svg'), iconSvg);
  process.stdout.write('  public/favicon.svg\n');

  await writeIcons(iconSvg);

  await sharp(ogCard(fonts))
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, 'og.png'));
  process.stdout.write('  public/og.png\n');

  process.stdout.write('Assets regenerated.\n');
}

await main();

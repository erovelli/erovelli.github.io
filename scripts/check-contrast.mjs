/**
 * Verifies the color tokens in src/styles/global.css meet their contrast
 * targets in both themes.
 *
 * The token values are parsed out of the stylesheet rather than restated here,
 * so this cannot drift: changing a color and re-running `npm run validate` is
 * the only way to find out whether the change is legible. Without this, the
 * palette's accessibility is a claim in a README that nothing enforces.
 *
 * Run standalone with:
 *
 *     npm run check:contrast
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssPath = path.join(root, 'src/styles/global.css');

/** WCAG 2.2 SC 1.4.3, normal-sized text. */
const AA_TEXT = 4.5;
/** WCAG 2.2 SC 1.4.11, UI component boundaries and focus indicators. */
const AA_NON_TEXT = 3.0;
/**
 * Not a WCAG figure. Decorative separators are exempt from 1.4.11 because they
 * convey no state, but a hairline below roughly this ratio is invisible on a
 * bright screen, which defeats the purpose of drawing it.
 */
const PERCEPTIBLE = 1.5;

/**
 * Every foreground/background combination the stylesheet actually produces.
 * Add a row whenever a rule pairs a new text color with a new surface.
 */
const PAIRS = [
  ['--ink', '--canvas', AA_TEXT, 'body text on the page'],
  ['--ink-muted', '--canvas', AA_TEXT, 'muted text on the page'],
  ['--ink', '--surface', AA_TEXT, 'body text on a module'],
  ['--ink-muted', '--surface', AA_TEXT, 'muted text on a module'],
  ['--accent', '--canvas', AA_TEXT, 'accent link on the page'],
  ['--accent', '--surface', AA_TEXT, 'accent link on a module'],
  ['--accent-strong', '--canvas', AA_TEXT, 'hovered accent link'],
  ['--ink', '--accent-tint', AA_TEXT, 'text on a highlighted row'],
  ['--surface', '--accent', AA_TEXT, 'filled action label'],
  ['--surface', '--accent-strong', AA_TEXT, 'hovered filled action label'],
  ['--focus', '--canvas', AA_NON_TEXT, 'focus ring against the page'],
  ['--rule', '--canvas', AA_NON_TEXT, 'module border against the page'],
  ['--rule-subtle', '--surface', PERCEPTIBLE, 'hairline separator on a module'],
];

/* ------------------------------------------------------------------ parse --- */

/** Extracts `--name: value;` declarations from a block of CSS text. */
function declarations(block) {
  const map = new Map();
  for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    map.set(match[1], match[2].trim());
  }
  return map;
}

/**
 * Returns the body of the first `:root { ... }` block starting at `from`.
 * Brace-counted rather than regexed, since the dark theme nests :root inside a
 * media query.
 */
function rootBlock(css, from = 0) {
  const start = css.indexOf(':root', from);
  if (start === -1) return null;

  const open = css.indexOf('{', start);
  let depth = 0;

  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return { body: css.slice(open + 1, i), end: i };
    }
  }
  return null;
}

/** Resolves `var(--x)` chains down to a literal hex color. */
function resolve(name, tokens, seen = new Set()) {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`token ${name} is not defined`);
  if (seen.has(name)) throw new Error(`token ${name} references itself`);

  const reference = value.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i);
  if (reference) return resolve(reference[1], tokens, new Set([...seen, name]));

  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`token ${name} is not a 6-digit hex color: ${value}`);
  }
  return value.toLowerCase();
}

/* ------------------------------------------------------------- arithmetic --- */

const channels = (hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

const linearize = (c) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

/** Relative luminance, WCAG 2.x definition. */
function luminance(hex) {
  const [r, g, b] = channels(hex).map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/* ------------------------------------------------------------------- main --- */

async function main() {
  const css = await readFile(cssPath, 'utf8');

  const light = rootBlock(css);
  if (!light) throw new Error('no :root block found in global.css');

  const dark = rootBlock(css, light.end);
  if (!dark) throw new Error('no dark-theme :root block found in global.css');

  const lightTokens = declarations(light.body);
  // The dark block overrides a subset, so start from light and layer on top.
  const darkTokens = new Map([...lightTokens, ...declarations(dark.body)]);

  const failures = [];

  for (const [themeName, tokens] of [
    ['light', lightTokens],
    ['dark', darkTokens],
  ]) {
    process.stdout.write(`\n  ${themeName}\n`);

    for (const [fgToken, bgToken, minimum, label] of PAIRS) {
      const ratio = contrast(
        resolve(fgToken, tokens),
        resolve(bgToken, tokens),
      );
      const ok = ratio >= minimum;
      if (!ok) failures.push({ themeName, label, ratio, minimum });

      process.stdout.write(
        `    ${ok ? 'pass' : 'FAIL'}  ${ratio.toFixed(2).padStart(5)}:1` +
          `  (min ${minimum.toFixed(1)})  ${label}\n`,
      );
    }
  }

  if (failures.length > 0) {
    process.stderr.write(
      `\nContrast check failed: ${failures.length} pair(s) below target.\n\n`,
    );
    for (const { themeName, label, ratio, minimum } of failures) {
      process.stderr.write(
        `  ${themeName}: ${label} is ${ratio.toFixed(2)}:1, needs ${minimum.toFixed(1)}:1\n`,
      );
    }
    process.stderr.write('\n');
    process.exit(1);
  }

  process.stdout.write(
    `\nContrast check passed: ${PAIRS.length * 2} pairs across 2 themes.\n`,
  );
}

await main();

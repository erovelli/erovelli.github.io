/**
 * Icon registries, as URLs.
 *
 * Both sets are masked rather than inlined — see `.brand-icon` and
 * `.pixel-icon` — so a caller only ever needs the file's URL.
 *
 * The pixelarticons map lives here rather than inside `PixelIcon.astro`
 * because two callers need it: the component, which renders a masked `<span>`,
 * and `NowPanel`, which sets the same custom property on a `::before` so the
 * icon is not a child node. A `<dl>` may only contain `<dt>`, `<dd>` and
 * `<div>` wrappers, and a wrapper may only contain `<dt>` and `<dd>` — so a
 * decorative icon inside one has to be drawn by CSS, not markup.
 *
 * The brand map is here for a different reason: `config.ts` needs the name
 * type to validate `socials[].icon`, and importing a type out of an `.astro`
 * file to do it is not something the config layer should have to know about.
 */
import githubBrand from './assets/icons/brands/github.svg?url';
import linkedinBrand from './assets/icons/brands/linkedin.svg?url';

export const brandIcons = {
  github: githubBrand,
  linkedin: linkedinBrand,
} as const;

export type BrandIconName = keyof typeof brandIcons;

import bookOpen from './assets/icons/pixelarticons/book-open-sharp.svg?url';
import chart from './assets/icons/pixelarticons/chart-sharp.svg?url';
import computer from './assets/icons/pixelarticons/computer-sharp.svg?url';
import fileText from './assets/icons/pixelarticons/file-text-sharp.svg?url';
import gitBranch from './assets/icons/pixelarticons/git-branch-sharp.svg?url';
import keyboardMusic from './assets/icons/pixelarticons/keyboard-music-sharp.svg?url';
import mail from './assets/icons/pixelarticons/mail-sharp.svg?url';
import smile from './assets/icons/pixelarticons/smile-sharp.svg?url';
import terminal from './assets/icons/pixelarticons/terminal-sharp.svg?url';
import toolCase from './assets/icons/pixelarticons/tool-case-sharp.svg?url';

export const pixelIcons = {
  'book-open': bookOpen,
  chart,
  computer,
  'file-text': fileText,
  'git-branch': gitBranch,
  'keyboard-music': keyboardMusic,
  mail,
  smile,
  terminal,
  'tool-case': toolCase,
} as const;

export type PixelIconName = keyof typeof pixelIcons;

/** The `--pixel-icon-source` declaration for a given icon. */
export const pixelIconSource = (name: PixelIconName) =>
  `--pixel-icon-source: url("${pixelIcons[name]}")`;

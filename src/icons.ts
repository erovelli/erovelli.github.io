/**
 * The pixelarticons set, as URLs.
 *
 * Kept in a module rather than inside `PixelIcon.astro` because two callers
 * need it: the component, which renders a masked `<span>`, and `NowPanel`,
 * which sets the same custom property on a `::before` so the icon is not a
 * child node. A `<dl>` may only contain `<dt>`, `<dd>` and `<div>` wrappers,
 * and a wrapper may only contain `<dt>` and `<dd>` — so a decorative icon
 * inside one has to be drawn by CSS, not markup.
 */
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

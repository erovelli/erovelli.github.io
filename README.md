# erovel.li

Source for [erovel.li](https://erovel.li), Evan Rovelli's personal site. Static
Astro 7, self-hosted fonts, and a progressively enhanced theme control, deployed
to GitHub Pages.

Conventions and the reasoning behind them are in [AGENTS.md](./AGENTS.md). Read
that before changing anything structural.

## Local development

Node version is pinned in `.node-version` (currently 24) and every other config
defers to it. With a matching Node active:

```sh
npm ci
npm run dev
```

| Command                  | Purpose                                           |
| ------------------------ | ------------------------------------------------- |
| `npm run dev`            | Development server                                |
| `npm run build`          | Build the static site into `dist/`                |
| `npm run check`          | Astro template and TypeScript diagnostics         |
| `npm run check:contrast` | Verify colour tokens meet WCAG AA in both themes  |
| `npm run check:build`    | Verify `dist/`: links, meta, headings, assets     |
| `npm run validate`       | Everything CI runs, in order                      |
| `npm run format`         | Apply Prettier                                    |
| `npm run format:check`   | Verify formatting without writing                 |
| `npm run assets`         | Regenerate favicons and the OG card from `tools/` |

`npm run validate` is the gate: `format:check`, `astro check`,
`check:contrast`, a production build, then `check:build` against the output. It
is exactly what CI and the deploy workflow run.

### Why there are two extra check steps

Formatting, types and a successful build together do not notice a dead internal
link, a page with no meta description, a missing favicon, an Open Graph image
that 404s, or a heading outline that skips from `h1` to `h4`. All of those
shipped in the first version of this site and passed every other check.
`scripts/check-build.mjs` walks the built output and fails on them.

`scripts/check-contrast.mjs` parses the colour tokens straight out of
`global.css` and asserts every foreground/background pair the stylesheet
produces clears its target in both themes. Parsing rather than restating the
values is the point: a palette tweak that hurts legibility fails the build
instead of shipping. Both scripts are dependency-free and make no network calls,
so CI cannot fail because someone else's server was down.

## Identity and content

Everything about Evan that appears as a string — name, role, location, email,
social links, résumé URL — lives in **`site.config.json`** at the repo root. Both
`src/config.ts` and the asset generator read it, so the pages, the JSON-LD, the
manifest and the OG card cannot disagree.

Projects, interests, and the shared “Now” profile content are Markdown content
collections:

```text
src/content/
├── interests/
├── profile/
└── projects/
```

Add a file, copy the frontmatter from a sibling, and the Zod schema in
`src/content.config.ts` validates it at build time. The filename becomes the
slug. `order` sorts; `featured: true` promotes a project to the homepage.

Design tokens and all shared styles are in `src/styles/global.css`. It documents
its own rules at the top.

## Brand assets

`public/favicon*`, `public/apple-touch-icon.png` and `public/og.png` are
generated from `tools/icon.svg` plus `site.config.json`:

```sh
npm run assets
```

Outputs are committed, so the build needs no network access. The script fetches a
pinned Inter into a gitignored cache and converts the OG card's text to vector
paths — see AGENTS.md for why `<text>` cannot be used here.

Inter itself is self-hosted in `public/fonts/` as two subset woff2 files (~130 KB
total) and preloaded. There is no webfont CDN and no font in the CSS stack that
only exists on macOS.

The small interface icons are an unchanged, vendored subset of
[Pixelarticons](https://pixelarticons.com/) 2.2.0. The GitHub brand glyph comes
from [Simple Icons](https://simpleicons.org/) 16.21.0. Source and license notes
live beside each set in `src/assets/icons/`; no icon font or runtime package is
shipped.

## Accessibility and theming

- Automatic light and dark themes via `prefers-color-scheme`, plus a compact
  persisted override. A small inline script resolves the palette before first
  paint; core content and navigation remain fully functional without it.
- All text meets WCAG AA contrast in both themes, enforced by
  `npm run check:contrast` rather than asserted here.
- One primary link per index row, skip link, real landmarks, sequential headings,
  visible focus states, and
  `prefers-reduced-motion` respected.

## Deployment

Pushes to `main` and pull requests both run CI. Pushes to `main` additionally
build and publish to GitHub Pages; deploys can also be triggered from the
Actions tab.

The Pages concurrency group uses `cancel-in-progress: false` on purpose: a
deployment already publishing is allowed to finish rather than being cancelled
mid-flight.

Before the first deployment:

1. Open **Settings → Pages** in `erovelli/erovelli.github.io`.
2. Set **Source** to **GitHub Actions**.
3. Under **Custom domain**, enter `erovel.li`.
4. Enable **Enforce HTTPS** once GitHub has issued the certificate.

GitHub Actions deployments do not use a repository `CNAME` file; the custom
domain lives in the Pages settings.

Note that `site.config.json` sets `url` to `https://erovel.li`, so canonical
URLs, the sitemap and OG tags all point there. Until the custom domain resolves,
the site served at `erovelli.github.io` will reference a domain that does not yet
answer. Configure DNS before sharing links.

## DNS for erovel.li

Verify the domain in GitHub before pointing DNS at Pages.

| Type  | Name  | Value                |
| ----- | ----- | -------------------- |
| A     | `@`   | `185.199.108.153`    |
| A     | `@`   | `185.199.109.153`    |
| A     | `@`   | `185.199.110.153`    |
| A     | `@`   | `185.199.111.153`    |
| CNAME | `www` | `erovelli.github.io` |

Do not add a wildcard record. GitHub Pages redirects `www.erovel.li` to the
canonical apex once both are configured. DNS and certificate changes can take up
to 24 hours.

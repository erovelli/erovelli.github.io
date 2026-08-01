# Working in this repo

Personal site for erovel.li. Static Astro 7, no client-side JavaScript, deployed
to GitHub Pages. It is deliberately a small codebase with strong conventions;
the conventions are the point, so read this before adding anything.

## Commands

```sh
npm run dev            # dev server
npm run validate       # everything CI runs: format, types, build, dist checks
npm run check:build    # dist verification on its own (needs a build first)
npm run assets         # regenerate favicons and the OG card (rarely needed)
npm run format         # fix formatting
```

Run `npm run validate` before pushing. It is the same command CI and deploy run,
so a green local run means a green pipeline.

Node version comes from `.node-version` and nothing else. CI, deploy and
`package.json` engines all defer to it — do not restate the version anywhere.

## Where things live

```
site.config.json          identity: name, role, location, email, socials, profiles
src/config.ts             types site.config.json, derives title/mailto/sameAs, nav order
src/schema.ts             every JSON-LD node, built from config and collections
src/styles/global.css     design tokens and every shared style
src/layouts/BaseLayout    <head>, meta, social cards, JSON-LD, skip link, shell
src/components/           Header, Footer, PageIntro, Breadcrumbs, ProjectCard, InterestCard
src/content/              projects/ and interests/ as Markdown
src/content.config.ts     Zod schemas for both collections
src/pages/                routes, plus robots.txt.ts and manifest.json.ts
scripts/check-build.mjs   post-build verification, zero dependencies
scripts/generate-assets.mjs  rasterizes icons and the OG card
tools/icon.svg            source of truth for every icon
public/                   generated assets + self-hosted Inter subsets
```

## Non-negotiables

**No biography outside `site.config.json`.** Name, role, location, email and
social links are read from there. If you find yourself typing "Cambridge" into a
component, stop — that is the bug this structure exists to prevent. Prose about
Evan lives in `src/pages/about.astro` and the content collections.

**No raw values in CSS.** Every color, size, space and width is a token in
`global.css`. Need something that does not exist? Add a token. Components
reference semantic tokens (`--color-text-muted`), never palette primitives
(`--stone-600`), because that is what makes the dark theme a ten-line change.

**No client-side JavaScript.** There is currently zero JS shipped to the browser
and that is a feature. Dark mode is `prefers-color-scheme` only, with no toggle,
because a toggle needs JS and a persistence story. If you genuinely need
interactivity, use an Astro island and keep it to that one component.

**One left edge.** Everything in `.site-shell` aligns to the same left margin;
text is constrained with `max-width`, never centered. Do not add centered columns.

**American English everywhere.** Color, behavior, organize, optimize, centered,
gray. This covers rendered copy, code comments, identifiers and these docs
alike — Evan is American, and a site that says "colour" in one file and "color"
in the next reads as written by two people.

**Microcopy floor is `--text-2xs` (13px).** The first version of this site set
labels at 10px uppercase with letterspacing. That is decoration pretending to be
information.

**No decoration that implies data it does not have.** No status dots that never
change, no coordinates, no fake code comments around labels, no counters whose
numbers depend on which page you are looking at.

**Headings must nest.** Cards take a `headingLevel` prop for exactly this
reason: an `h2` section heading followed by `h2` card titles is a flat outline.
`check-build.mjs` fails the build if levels skip.

**No résumé.** Not a PDF, not an HTML `/resume/` route, not a download button.
This is a settled decision, not an absent one — `/about/` and the project pages
are what this site says about Evan's work. Do not add a `resumeUrl` back to
`site.config.json`.

**Every route needs its own description.** `BaseLayout` falls back to the
site-wide description when a page passes none, which is a convenience that
silently produces a dozen pages competing for one search result. The build gate
fails on duplicates, so the fallback is really only for the homepage.

**Structured data may not outrun the page.** Everything `src/schema.ts` asserts
is also stated in rendered copy — `knowsAbout` has a matching sentence on
`/about/`, `alumniOf` matches the Background paragraph. Schema that disagrees
with the visible page is worse than no schema, so if you add a property, add
the copy that backs it.

**The handle is load-bearing.** `username` in `site.config.json` is "erovelli",
and it appears in exactly four rendered places: the homepage `<title>`, the
`/about/` description, the Elsewhere paragraph on `/about/`, and each footer
link, which is what puts it on every page. `Person.alternateName` asserts it,
and is only allowed to because those four exist. Do not remove one as
redundant — the domain reads as the handle to a human but tokenizes as "erovel"
and "li" to a search engine, so without the spelled-out string the site matches
nothing for the query people actually type.

## Adding a project or interest

Create a Markdown file in `src/content/projects/` or `src/content/interests/`.
The filename becomes the URL slug. Copy the frontmatter from a sibling; the Zod
schema in `src/content.config.ts` validates it at build time.

`order` controls sort position. For projects, `featured: true` puts it on the
homepage — there is no cap, so the homepage shows exactly the featured set.

`summary` is not optional in practice: it is the page's meta description, and
the build fails if two pages share one. Keep it under 160 characters.

Projects carry four fields that exist only for structured data. `languages` is
the machine-readable subset of `technologies`, which mixes languages with
runtimes and APIs and so cannot be handed to schema.org as-is. `schemaType`
defaults to `CreativeWork`; claim `SoftwareApplication` only for something a
visitor can install or run, and give it an `applicationCategory`. `related`
lists interest slugs, and the project page throws at build time on a slug that
does not exist. The interest → project direction is the inverse of that list,
computed at build, so the mapping is declared exactly once.

## Regenerating brand assets

`npm run assets` reads `tools/icon.svg` and `site.config.json` and writes the
favicons, apple-touch-icon and `public/og.png`. Outputs are committed; the build
never runs this, so `npm run build` needs no network access.

One trap worth knowing: **the librsvg bundled inside sharp ignores
`font-family` entirely.** Rendering `<text>` with "Inter", "Helvetica" and a
deliberately nonexistent family produces byte-identical output. That is why the
OG card converts text to vector paths with `opentype.js` and a pinned Inter
instead of emitting `<text>`. Do not "simplify" it back to `<text>` — the card
would silently render in whatever font that sharp build happens to default to,
and would differ between macOS and CI.

`opentype.js` cannot call `font.getPath(string)` on Inter either; one of its
`ccmp` lookups is unsupported and throws. The script walks glyph by glyph with
explicit kerning instead.

## What the build gate actually checks

`scripts/check-build.mjs` walks `dist/` and fails on: dead internal links,
missing or overlong meta descriptions, a description shared by two pages, a
missing or wrong `author`, missing canonical, a canonical that does not match
the page's own URL, missing favicon, missing Open Graph tags, an `og:image`
that does not resolve to a real file, JSON-LD that does not parse or is missing
`@context`/`@type`, a page with no `Person` node, `<img>` without `alt`,
`target="_blank"` without `noopener`/`noreferrer`, heading levels that skip,
more or fewer than one `h1`, and visible
`TODO`/`FIXME`/`PLACEHOLDER`/`Lorem ipsum`.

Every one of those defects existed in the first version of this site and passed
`prettier`, `astro check` and `astro build`. That is why the script exists. If
you add a category of mistake, add a check.

Note the placeholder check applies to rendered text only. TODO notes inside
frontmatter fences or `.astro` comments do not ship to the browser and are fine.

## Open TODOs that need Evan, not an agent

These are deliberately absent rather than invented. Do not fill them in with
plausible-sounding guesses:

- **Project write-ups.** Every entry in `src/content/projects/` is frontmatter
  with no body, so each detail page renders a title, a summary and a metadata
  rail. This is the single largest thing holding the site back in search: the
  structural work is done, and prose is what remains. What the problem was,
  what the approach was, what broke. An agent cannot supply this and should not
  try — a plausible-sounding account of a project you actually built is worse
  than the empty page it replaced.
- **Employment dates and titles.** `/about/` currently says only "at Fidelity".
- **Education specifics.** Only "computer engineering at UMass Amherst" is
  stated, which is what the ModuLoop entry already implied.
- **Non-technical interests.** All five entries in `src/content/interests/` are
  software topics, so `/interests/` currently reads as a second projects page.
  Anything genuinely off-the-clock has to come from Evan.
- **Email address.** `site.config.json` uses a personal Gmail address. Consider
  an alias on the domain once DNS is live.

## Astro reference

<https://docs.astro.build> — [routing](https://docs.astro.build/en/guides/routing/),
[components](https://docs.astro.build/en/basics/astro-components/),
[content collections](https://docs.astro.build/en/guides/content-collections/),
[styling](https://docs.astro.build/en/guides/styling/).

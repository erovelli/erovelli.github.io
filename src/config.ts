/**
 * Site identity and navigation.
 *
 * The raw values live in `site.config.json` at the repo root so that both this
 * module and `scripts/generate-assets.mjs` (plain Node, no TypeScript) read the
 * same source. Nothing else in the codebase should hardcode a name, location,
 * role or URL — if a string of biography appears in a component, it belongs here.
 */
import identity from '../site.config.json';
import { brandIcons, type BrandIconName } from './icons';

export interface Social {
  label: string;
  href: string;
  handle: string;
  /** Brand mark for this profile. See `src/assets/icons/brands/README.md`. */
  icon: BrandIconName;
  /**
   * Emit `rel="me"` on links to this profile, claiming it as the same identity.
   *
   * GitHub reciprocates: the profile Website field is rendered with
   * `rel="nofollow me"`, so the claim is symmetric and machine-verifiable.
   * LinkedIn does not — it wraps outbound links in a redirector — so an
   * unreciprocated `rel="me"` there asserts something nothing corroborates.
   */
  me?: boolean;
}

export interface SiteIdentity {
  name: string;
  initials: string;
  /**
   * The handle Evan uses everywhere else, and the thing people actually type
   * into a search box.
   *
   * It needs saying out loud. `erovel.li` is the same nine letters with a dot
   * in them, but a search engine tokenizes the domain as "erovel" and "li" and
   * so matches nothing for the one-word query — while github.com/erovelli and
   * linkedin.com/in/erovelli carry it in their URL, title and body copy. The
   * footer renders each profile's `handle`, /about/ states the name in prose,
   * and `Person.alternateName` asserts it; those three are the same claim in
   * three registers, which is the only reason the schema is allowed to make it.
   */
  username: string;
  role: string;
  description: string;
  domain: string;
  url: string;
  location: string;
  locationShort: string;
  email: string;
  addressLocality: string;
  addressRegion: string;
  /** ISO 3166-1 alpha-2, as schema.org PostalAddress expects. */
  addressCountry: string;
  alumniOf: string;
  /**
   * Subject areas, asserted in Person schema and stated in prose on /about/.
   * Written in mid-sentence case — proper nouns capitalised, nothing else —
   * because the page renders them verbatim inside a sentence, and no amount of
   * `toLowerCase()` knows that Rust is a name and embedded systems is not.
   */
  knowsAbout: string[];
  socials: Social[];
  /**
   * Further URLs that identify the same person but are not links the site
   * renders — store listings, directory entries. These join the social hrefs
   * in `sameAs`, which is how search engines merge scattered profiles into one
   * entity. Anything a visitor should be able to click belongs in `socials`.
   */
  profiles: string[];
}

/*
  A JSON import widens every string to `string`, so `icon` arrives untyped and
  a typo would survive to runtime as a `url("undefined")` mask — an icon-shaped
  hole, on every page, that nothing else would catch. Narrowing it here turns
  that into a build failure naming the offending value.
*/
const toSocial = (social: (typeof identity.socials)[number]): Social => {
  if (!(social.icon in brandIcons)) {
    throw new Error(
      `site.config.json: ${social.label} has icon "${social.icon}", which is not in ` +
        `src/assets/icons/brands (${Object.keys(brandIcons).join(', ')}).`,
    );
  }

  return { ...social, icon: social.icon as BrandIconName };
};

const base: SiteIdentity = {
  ...identity,
  socials: identity.socials.map(toSocial),
};

export const site = {
  ...base,
  /**
   * Homepage <title>. Every other route composes its own as "Page — Name", so
   * this string is the homepage's alone.
   *
   * The parenthesised handle is there on purpose: it is the exact string people
   * type, and a <title> is the strongest place on a page to answer a query
   * literally. `og:site_name` stays plain `name`, so the handle appears once,
   * where it earns its place, rather than in every share card.
   */
  title: `${base.name} (${base.username}) — ${base.role}`,
  mailto: `mailto:${base.email}`,
  /** Every URL asserting this identity, for schema.org `sameAs`. */
  sameAs: [...base.socials.map((social) => social.href), ...base.profiles],
} as const;

export interface NavItem {
  label: string;
  href: string;
}

/**
 * Primary navigation. Order is deliberate: the work first, then the biography.
 */
export const navigation: readonly NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '/projects/' },
  { label: 'About', href: '/about/' },
] as const;

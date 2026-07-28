/**
 * Site identity and navigation.
 *
 * The raw values live in `site.config.json` at the repo root so that both this
 * module and `scripts/generate-assets.mjs` (plain Node, no TypeScript) read the
 * same source. Nothing else in the codebase should hardcode a name, location,
 * role or URL — if a string of biography appears in a component, it belongs here.
 */
import identity from '../site.config.json';

export interface Social {
  label: string;
  href: string;
  handle: string;
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

const base: SiteIdentity = identity;

export const site = {
  ...base,
  /** Default <title>, also used as the Open Graph site title. */
  title: `${base.name} — ${base.role}`,
  mailto: `mailto:${base.email}`,
  /** Every URL asserting this identity, for schema.org `sameAs`. */
  sameAs: [...base.socials.map((social) => social.href), ...base.profiles],
} as const;

export interface NavItem {
  label: string;
  href: string;
}

/**
 * Primary navigation. Order is deliberate: the work first, then the personal
 * pages, then the biography.
 */
export const navigation: readonly NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '/projects/' },
  { label: 'Interests', href: '/interests/' },
  { label: 'About', href: '/about/' },
] as const;

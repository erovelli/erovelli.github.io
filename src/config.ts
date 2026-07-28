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
  /** Path or URL to a CV. Null until one exists; the UI hides the link. */
  resumeUrl: string | null;
  socials: Social[];
}

const base: SiteIdentity = identity;

export const site = {
  ...base,
  /** Default <title>, also used as the Open Graph site title. */
  title: `${base.name} — ${base.role}`,
  mailto: `mailto:${base.email}`,
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

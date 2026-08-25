/**
 * schema.org JSON-LD builders.
 *
 * Search engines treat a personal site as one entity per `@id`, so everything
 * here hangs off two stable identifiers — `#person` and `#website` — and every
 * other node references them rather than restating the identity. That is what
 * lets a project page say "authored by the same Evan Rovelli as the homepage"
 * instead of introducing a fifth unrelated person called Evan Rovelli.
 *
 * Values come from `site.config.json` and the content collections. Nothing here
 * should assert a fact the rendered page does not also state: structured data
 * that disagrees with the visible page is worse than none.
 */
import type { CollectionEntry } from 'astro:content';
import { site } from './config';

/** Absolute URL for a site-relative path. */
const absolute = (path: string) => new URL(path, site.url).href;

export const PERSON_ID = `${site.url}/#person`;
export const WEBSITE_ID = `${site.url}/#website`;

export const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': PERSON_ID,
  name: site.name,
  alternateName: site.username,
  url: absolute('/'),
  image: absolute('/og.png'),
  jobTitle: site.role,
  email: site.email,
  address: {
    '@type': 'PostalAddress',
    addressLocality: site.addressLocality,
    addressRegion: site.addressRegion,
    addressCountry: site.addressCountry,
  },
  alumniOf: {
    '@type': 'CollegeOrUniversity',
    name: site.alumniOf,
  },
  knowsAbout: site.knowsAbout,
  sameAs: site.sameAs,
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: site.name,
  url: absolute('/'),
  inLanguage: 'en',
  author: { '@id': PERSON_ID },
  publisher: { '@id': PERSON_ID },
};

export interface Crumb {
  label: string;
  href: string;
}

export function breadcrumbSchema(crumbs: readonly Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      item: absolute(crumb.href),
    })),
  };
}

/**
 * A project renders as `SoftwareApplication` when it is something a visitor can
 * install or run, and `CreativeWork` otherwise — ModuLoop is a physical
 * instrument, not an application, and claiming otherwise would fail validation
 * on the properties Google expects of software.
 */
export function projectSchema(project: CollectionEntry<'projects'>) {
  const { data, id } = project;
  const contributors = data.contributors ?? [];
  const sameAs = [data.repository, data.live].filter(
    (url): url is string => typeof url === 'string',
  );
  const creators =
    contributors.length > 0
      ? contributors.map(({ name, url }) =>
          name === site.name
            ? { '@id': PERSON_ID }
            : {
                '@type': 'Person',
                name,
                ...(url ? { url } : {}),
              },
        )
      : [{ '@id': PERSON_ID }];

  return {
    '@context': 'https://schema.org',
    '@type': data.schemaType,
    '@id': `${absolute(`/projects/${id}/`)}#project`,
    name: data.title,
    url: absolute(`/projects/${id}/`),
    ...(data.summary ? { description: data.summary } : {}),
    author: creators,
    creator: creators,
    isPartOf: { '@id': WEBSITE_ID },
    datePublished: String(data.year),
    ...(data.languages.length > 0
      ? { programmingLanguage: data.languages }
      : {}),
    ...(data.schemaType === 'SoftwareApplication'
      ? {
          ...(data.applicationCategory
            ? { applicationCategory: data.applicationCategory }
            : {}),
          ...(data.operatingSystem
            ? { operatingSystem: data.operatingSystem }
            : {}),
          /* Free, but priced explicitly: Google drops an Offer without one. */
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
        }
      : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    /* Optional: entries carry a title and metadata until their copy is
       written. Everything that renders a summary omits the element when it
       is absent rather than leaving an empty one behind. */
    summary: z.string().optional(),
    status: z.string(),
    year: z.number(),
    order: z.number(),
    featured: z.boolean().default(false),
    technologies: z.array(z.string()),
    contributors: z
      .array(
        z.object({
          name: z.string(),
          url: z.url().optional(),
        }),
      )
      .default([]),
    repository: z.url().optional(),
    live: z.url().optional(),
    liveLabel: z.string().default('Live site'),
    /* --- structured data ---
       `technologies` is prose for humans and mixes languages with runtimes and
       APIs, so it cannot be handed to schema.org as `programmingLanguage`.
       `languages` is the machine-readable subset. */
    languages: z.array(z.string()).default([]),
    /* CreativeWork by default: only claim SoftwareApplication for something a
       visitor can actually install or run. */
    schemaType: z
      .enum(['SoftwareApplication', 'CreativeWork'])
      .default('CreativeWork'),
    applicationCategory: z.string().optional(),
    operatingSystem: z.string().optional(),
  }),
});

const profile = defineCollection({
  loader: glob({ base: './src/content/profile', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    rows: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
        icon: z.enum(['computer', 'tool-case', 'book-open']),
      }),
    ),
  }),
});

export const collections = { projects, profile };

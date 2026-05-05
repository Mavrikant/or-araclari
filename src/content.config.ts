import { defineCollection } from 'astro:content';
import { z } from 'astro:schema';
import { glob } from 'astro/loaders';

const rehberler = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/rehberler' }),
  schema: z.object({
    title: z.string().min(10).max(80),
    description: z.string().min(60).max(200),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    relatedTool: z.string().optional(),
    keywords: z.array(z.string()).default([]),
    readingMinutes: z.number().int().positive().optional(),
    /**
     * Optional FAQ block. When present it is both rendered at the bottom of
     * the article and emitted as FAQPage JSON-LD for rich-result eligibility.
     * Answers are plain text — do not use markdown here.
     */
    faq: z
      .array(
        z.object({
          question: z.string().min(5).max(200),
          answer: z.string().min(20).max(800),
        }),
      )
      .optional(),
  }),
});

export const collections = { rehberler };

import { z } from "zod";

export const blogFrontmatterSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug must be kebab-case (a-z, 0-9, -)"),
  title: z.string().min(1),
  description: z.string().min(1),
  date: z
    .union([z.string(), z.date()])
    .transform((value) => (value instanceof Date ? value : new Date(value)))
    .refine((d) => !Number.isNaN(d.getTime()), { message: "date must be a valid ISO date" }),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
});

export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>;

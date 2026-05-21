import { z } from "zod";

export const newsArticleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  source: z.string().min(1),
  publishedAt: z.string().datetime(),
  body: z.string().min(1),
  relevanceScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  url: z.string().url().optional(),
  tickers: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  language: z.string().optional(),
});

export type NewsArticle = z.infer<typeof newsArticleSchema>;

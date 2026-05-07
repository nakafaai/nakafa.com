# SEO and Discovery

Use this reference when work touches content metadata, search snippets, sitemap discovery, crawlability, structured data, social previews, or AI/discovery surfaces.

## Principles

- Write for students first. Search metadata should summarize the actual learning value, not force keywords into the lesson.
- Keep each page useful from a direct search visit: define context early, answer the likely learning intent, and avoid generic filler.
- Do not keyword-stuff titles, descriptions, headings, alt text, or visible prose.
- Do not create shallow pages only to target search queries. Prefer one complete, teachable page over many thin pages.
- AI-assisted content is acceptable only after checking facts, math, sources, grammar, locale quality, and student usefulness.
- Visible summaries matter because search snippets may come from page content instead of meta descriptions. Keep hero copy, intro copy, headings, and descriptions aligned.

## Metadata

- Subject and article MDX must provide a specific `title`, natural `description`, `authors`, and valid `date`.
- Descriptions should say what the student will learn or what the article explains. Avoid reusable copy such as "complete material" when the file already has a better specific summary.
- Keep `id` and `en` metadata natural for their locale. Translate intent, not word order.
- Exercise question and answer files do not need per-file descriptions; route metadata may describe the exam, material, set, and question count.
- Metadata must match the visible content. Do not promise examples, visuals, sources, or solutions that are not present.
- Use stable brand names for site and organization structured data. Put page-specific value propositions in titles, descriptions, or alternate names.

## Structured Data

- Breadcrumb JSON-LD must describe the actual page hierarchy. Do not use homepage navigation, cards, or shortcut groups as breadcrumbs.
- Structured data must be visible-truthful: every marked-up entity or hierarchy should be supported by the rendered page and route structure.

## Visuals and Media

- If an image, chart, canvas, or interactive visual carries learning content, provide meaningful visible context and an accessible name or alt text.
- Keep essential explanations in DOM-visible text, not only inside canvas pixels.
- Decorative visuals should not receive keyword-heavy alt text.
- Captions and surrounding prose should explain what students should notice, not describe internal implementation.

## Sources and Claims

- Articles and current factual claims need visible references when the claim is not common classroom knowledge.
- Keep references close enough for readers to verify the claim. Do not invent citations.
- When adapting source material, write original explanations in Nakafa's teacher voice and preserve the verifiable facts.

## System Paths

- Route metadata: `apps/www/lib/utils/seo/`.
- Page metadata and structured data: `apps/www/app/[locale]/(app)/(shared)/(main)/(learn)/`.
- Site metadata and global JSON-LD: `apps/www/app/[locale]/layout.tsx`, `apps/www/app/manifest.ts`, and `packages/seo/json-ld/`.
- Sitemap discovery: `apps/www/lib/sitemap/`.
- Content metadata schema and readers: `packages/contents/_types/content.ts` and `packages/contents/_lib/metadata.ts`.

---
"@repo/backend": patch
"@repo/design-system": patch
"www": patch
---

Take the latest patch releases of KaTeX, react-day-picker, the Firecrawl SDK,
Hono, the Scalar OpenAPI parser, and the Next.js Playwright helper. KaTeX
0.18.10 renders the same markup and changes only its fallback font list,
putting the browser's math font before Times New Roman for glyphs its own fonts
lack. Every formula in today's lessons and try-outs draws with KaTeX's fonts
alone, so math looks exactly as before. The Firecrawl SDK now keeps its API key
on the API origin when it follows pagination links.

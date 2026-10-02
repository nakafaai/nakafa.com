---
"@repo/seo": patch
"@repo/typescript-config": patch
"www": patch
---

Describe each lesson and article to search engines with one JSON-LD document
that holds only what Google Search documents today: an Article with its
headline, description, authors, publication dates, language, and canonical
URL, and a BreadcrumbList that ends at the page. The LearningResource node goes,
because Google retired the learning video results that read it, and the
Article names its publisher by the site's organization node instead of
repeating the whole company record.

`@repo/seo` is an ES module so its TypeScript loads as ESM wherever it runs,
including the Playwright suite. The React library TypeScript config resolves
modules the way its bundled consumers do, like every other shared config.

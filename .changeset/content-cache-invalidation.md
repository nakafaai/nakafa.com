---
"www": patch
---

Replace forced content cache deletion with stale-while-revalidate invalidation. A publication now marks the changed scope and the sitemap stale instead of deleting them, so an unchanged regeneration costs no ISR write units and a publish no longer becomes a blocking cache miss. The content freshness policy and the Next cache profile now live in one module, and cached SEO metadata carries the family tag that invalidates it.

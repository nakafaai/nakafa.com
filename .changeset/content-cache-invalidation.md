---
"www": patch
---

Replace forced content cache deletion with stale-while-revalidate invalidation. A publication now marks the changed scope and the sitemap stale instead of deleting them, so a publish no longer becomes a blocking cache miss. Cached SEO metadata carries the family tag that invalidates it, which it previously lacked, and the content profile no longer force-expires every entry once a day, so an entry refreshes in the background after its revalidation interval instead of being regenerated in the foreground. The content freshness policy and the Next cache profile now live in one module.

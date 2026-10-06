---
"www": patch
---

Answer 404 for a sitemap page that does not exist. A sitemap address in the
right format but past the last published page returned a server error,
because the "page not found" result was thrown inside a cached read and
arrived at the route as an unknown failure. The cached read now returns a
missing page as data, and a browser test requests a missing page against the
production build.

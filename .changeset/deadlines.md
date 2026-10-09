---
"www": patch
---

Requests that had no time limit now end after 10 seconds. The Better Auth proxy answers 504 after 15 seconds. The browser auth client aborts a request after 10 seconds. Locale switching and copy-source reads retry network failures. Consent writes end each attempt after 10 seconds. Indexing scripts stop waiting after 10 seconds.

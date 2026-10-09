---
"www": patch
---

The indexing scripts now have tests for their Google and IndexNow request paths, including the 10 second deadline on every request. IndexNow treats a 202 answer as submitted, and a Bing run now fails on an unexpected status while keeping the URLs it accepted before that failure.

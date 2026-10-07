---
"@repo/backend": patch
---

Send every Nina model call through the Convex AI gateway, so the backend no
longer holds a Vercel gateway key or routing. Each call keeps its reasoning
effort and time limits, and each usage row records the gateway's reported cost.
Research drops Google Search grounding, which the gateway cannot run, and keeps
its Firecrawl web search evidence.

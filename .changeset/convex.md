---
"@repo/backend": patch
"@repo/design-system": patch
"www": patch
---

Send every Nina model call through the Convex AI gateway, with no Vercel
gateway key, routing, or spend tags. The AI SDK is 7.0.130. Nina answers with
the same models, reasoning, and time limits as before. Each usage row records
the cost the gateway reports, and research drops Google Search grounding, which
the gateway cannot run, and keeps its Firecrawl web search evidence.

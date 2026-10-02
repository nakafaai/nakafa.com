---
"@repo/backend": patch
"@repo/design-system": patch
"www": patch
---

Send every Nina model call through one gateway module. Each call names its
purpose, so AI Gateway spend reports split chat answers, specialists, background
work, follow-up suggestions, and titles, and no single call can loosen the
routing that keeps Gemini on Google's providers that do not train on prompts.
Nina answers with the same models, reasoning, and time limits as before, and a
failed answer shows the same message. The AI SDK moves to 7.0.127 together
with its gateway provider 4.0.103 and the Google provider 4.0.87.

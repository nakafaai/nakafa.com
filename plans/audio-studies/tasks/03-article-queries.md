# Task 0.3: Create Article Contents Query

## Goal
Add getById query for audio script generation.

## File
`packages/backend/convex/articleContents/queries.ts`

## Implementation

```typescript
import { internalQuery } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators";
import { v } from "convex/values";
import type { Id } from "@repo/backend/convex/_generated/dataModel";

export const getById = internalQuery({
  args: {
    id: vv.id("articleContents"),
  },
  returns: v.union(
    v.object({
      title: v.string(),
      description: v.optional(v.string()),
      body: v.string(),
      locale: v.union(v.literal("en"), v.literal("id")),
      contentHash: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args): Promise<{
    title: string;
    description?: string;
    body: string;
    locale: "en" | "id";
    contentHash: string;
  } | null> => {
    const article = await ctx.db.get("articleContents", args.id);
    if (!article) return null;
    return {
      title: article.title,
      description: article.description,
      body: article.body,
      locale: article.locale,
      contentHash: article.contentHash,
    };
  },
});
```

## Commands
```bash
pnpm typecheck
```

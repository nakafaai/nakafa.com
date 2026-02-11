# Task 0.4: Create Subject Sections Query

## Goal
Add getById query for audio script generation.

## File
`packages/backend/convex/subjectSections/queries.ts`

## Implementation

```typescript
import { internalQuery } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators";
import { v } from "convex/values";
import type { Id } from "@repo/backend/convex/_generated/dataModel";

export const getById = internalQuery({
  args: {
    id: vv.id("subjectSections"),
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
    const section = await ctx.db.get("subjectSections", args.id);
    if (!section) return null;
    return {
      title: section.title,
      description: section.description,
      body: section.body,
      locale: section.locale,
      contentHash: section.contentHash,
    };
  },
});
```

## Commands
```bash
pnpm typecheck
```

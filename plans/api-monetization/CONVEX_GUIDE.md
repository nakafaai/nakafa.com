# Convex Best Practices Guide

This guide applies to all tasks in the API monetization project using Convex.

## Core Principles

All Convex functions must follow these patterns:

### 1. Use Indexes, Not Filters

**Rule**: Filtering in code or with `.withIndex()` is better than `.filter()` on queries.

```typescript
// ✅ GOOD
const results = await ctx.db
  .query("tableName")
  .withIndex("by_field", (q) => q.eq("field", value))
  .collect();

// ❌ BAD
const all = await ctx.db.query("tableName").collect();
const results = all.filter(item => item.field === value);
```

### 2. Limit .collect() Results

**Rule**: All results from `.collect()` count toward database bandwidth. Use limits.

```typescript
// ✅ GOOD
const results = await ctx.db
  .query("tableName")
  .withIndex("by_date", (q) => q.gte("date", min))
  .take(100) // Always limit
  .collect();

// ❌ BAD - No limit, hits bandwidth
const results = await ctx.db.query("tableName").collect();
```

### 3. Use v.object() Validators

**Rule**: Public functions should use argument validators for security and type safety.

```typescript
// ✅ GOOD
export const myMutation = mutation({
  args: v.object({
    id: v.id("table"),
    name: v.string(),
  }),
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => { /* ... */ },
});

// ❌ BAD - Missing wrappers
export const myMutation = mutation({
  args: { id: v.id("table"), name: v.string() },
  handler: async (ctx, args) => { /* ... */ },
});
```

### 4. Use Helper Functions

**Rule**: Most code should be in `convex/model/` directory with thin API wrapper functions.

```typescript
// ✅ GOOD - Helper in model/
// packages/backend/convex/model/rateLimit.ts
export async function checkRateLimitHelper(ctx, args) {
  // Complex logic here
}

// routes/v1/index.ts - Thin wrapper
export const checkRateLimit = mutation({
  args: v.object({ /* ... */ }),
  returns: v.object({ /* ... */ }),
  handler: async (ctx, args) => {
    return await checkRateLimitHelper(ctx, args);
  },
});

// ❌ BAD - All logic in mutation
export const checkRateLimit = mutation({
  args: v.object({ /* ... */ }),
  handler: async (ctx, args) => {
    // 100+ lines of complex logic here
  },
});
```

### 5. No Sequential Calls

**Rule**: Sequential `ctx.runMutation/runQuery` calls run in separate transactions.

```typescript
// ✅ GOOD - Single transaction
export const cleanupRecords = mutation({
  args: v.object({ /* ... */ }),
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("records")
      .withIndex("by_id", (q) => q.eq("id", args.id))
      .collect();

    for (const record of records) {
      await ctx.db.delete("records", record._id);
    }
  },
});

// ❌ BAD - Sequential operations
export const cleanupRecords = mutation({
  args: v.object({ /* ... */ }),
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("records")
      .collect();

    for (const record of records) {
      await ctx.env.runMutation(  // SEQUENTIAL
        internal.records.mutations.deleteOne,
        { id: record._id }
      );
    }
  },
});
```

## Common Patterns

### Model Helper Functions

Place reusable logic in `packages/backend/convex/model/`:

```
packages/backend/convex/
├── model/
│   ├── rateLimit.ts      # Rate limiting helper
│   ├── scrapingDetection.ts  # Scraping detection helper
│   └── ipTracking.ts      # IP tracking helper
└── routes/
    └── v1/
        ├── contents/
        │   ├── list.ts         # Uses model helpers
        │   ├── get.ts           # Uses model helpers
        │   └── search.ts         # Uses model helpers
```

### Testability

Helper functions should be pure functions testable without Convex context:

```typescript
// ✅ GOOD - Pure function
export function calculateRateLimit(usage: number, limit: number) {
  return {
    allowed: usage < limit,
    remaining: Math.max(0, limit - usage),
  };
}

// ❌ BAD - Tied to Convex context
export async function checkRateLimit(ctx: QueryCtx, apiKeyId: string) {
  const usage = await ctx.db.query("usage").collect(); // Can't test this
  // ...
}
```

## Verification Checklist

For every Convex function:

- [ ] Uses `.withIndex()` instead of `.filter()`
- [ ] Uses `.take()` limit on `.collect()`
- [ ] Uses `v.object()` wrapper for args
- [ ] Uses `v.object()` wrapper for returns (public functions)
- [ ] Complex logic extracted to helper in `model/`
- [ ] No sequential `ctx.runMutation/runQuery` calls
- [ ] Helper functions are pure and testable

## Commands

```bash
# From root directory
pnpm lint
pnpm typecheck
pnpm test
```

All commands must pass before marking task complete.

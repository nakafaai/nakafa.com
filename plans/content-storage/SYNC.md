# Content Sync Guide

Sync MDX content from filesystem to Convex database.

## Prerequisites

Before running sync, you must be authenticated with Convex:

```bash
cd packages/backend
npx convex dev
```

This creates `~/.convex/config.json` with your access token.

## Commands

```bash
# Sync all content (articles, subjects, exercises)
pnpm --filter backend sync:all

# Sync specific content type
pnpm --filter backend sync:articles
pnpm --filter backend sync:subjects
pnpm --filter backend sync:exercises

# Sync specific locale only
pnpm --filter backend sync:subjects -- --locale en
pnpm --filter backend sync:exercises -- --locale id

# Verify database matches filesystem (no changes)
pnpm --filter backend sync:verify
```

## Content Structure

### Articles
```
packages/contents/articles/{category}/{articleSlug}/
├── en.mdx          # English content
├── id.mdx          # Indonesian content
└── ref.ts          # References/citations
```

### Subjects
```
packages/contents/subject/{category}/{grade}/{material}/{topic}/{section}/
├── en.mdx          # English content
└── id.mdx          # Indonesian content
```

### Exercises
```
packages/contents/exercises/{category}/{type}/{material}/{exerciseType}/{set}/{number}/
├── _question/
│   ├── en.mdx      # Question in English
│   └── id.mdx      # Question in Indonesian
├── _answer/
│   ├── en.mdx      # Answer in English
│   └── id.mdx      # Answer in Indonesian
└── choices.ts      # Multiple choice options
```

**Important:** Each exercise has 2 MDX files per locale (question + answer), but counts as 1 exercise in the database. The sync finds `_question/*.mdx` files and loads the corresponding `_answer/*.mdx` automatically.

## Current Stats

| Content Type | Items | Batches | Batch Size |
|--------------|-------|---------|------------|
| Articles | 14 | 1 | 50 |
| Subjects | 606 | 31 | 20 |
| Exercises | 920 | 31 | 30 |

**Total: 1,540 content items**

## How It Works

### 1. Parse MDX Files

Each MDX file contains:
```typescript
export const metadata = {
  title: "...",
  description: "...",
  date: "MM/DD/YYYY",
  authors: [{ name: "..." }]
};

// MDX body content below...
```

The sync script:
1. Reads the MDX file
2. Extracts metadata using regex
3. Validates with Zod schema
4. Normalizes whitespace in body
5. Computes SHA-256 hash for change detection

### 2. Batch Processing

Content is processed in batches to stay within Convex limits:
- Articles: 50 per batch (small files)
- Subjects: 20 per batch (medium files)
- Exercises: 30 per batch (includes choices)

### 3. Upsert to Convex

Each batch calls a bulk mutation that:
1. Checks if content exists (by locale + slug)
2. Compares content hash
3. Skips unchanged content
4. Creates or updates as needed
5. Updates author relationships
6. Updates references/choices

### 4. Hash-Based Change Detection

| Content Type | Hash Includes |
|--------------|---------------|
| Articles | body + references + authors |
| Subjects | body + authors |
| Exercises | questionBody + answerBody + choices + authors |

Unchanged content is skipped, making incremental syncs fast.

## File Structure

```
packages/backend/
├── scripts/
│   ├── sync-content.ts      # CLI entry point
│   └── lib/
│       └── mdxParser.ts     # MDX parsing utilities
├── convex/
│   └── contentSync/
│       ├── mutations.ts     # Bulk sync mutations
│       └── queries.ts       # Verify queries
└── package.json             # npm scripts
```

## Convex Best Practices

### Bulk Operations
All items in a batch are processed in a single Convex mutation (atomic transaction). Either all succeed or all fail.

### Internal Mutations
Sync mutations use `internalMutation` - they're not exposed to clients, only callable from backend scripts.

### Efficient Indexes
Each content table has `locale_slug` index for fast lookups during upsert.

### Normalized Schema
- Authors in separate table (not embedded)
- References in separate table
- Choices in separate table

This follows Convex recommendation to keep arrays small (< 10 elements).

## Troubleshooting

### "CONVEX_URL environment variable is not set"

Make sure `.env.local` exists in `packages/backend/`:
```
CONVEX_URL=https://your-deployment.convex.cloud
```

### "No access token found"

Run `npx convex dev` to authenticate.

### Sync shows 0 created, 0 updated

Content is unchanged (hash matches). This is normal for incremental syncs.

### Parse errors

Check the error message for file path. Common issues:
- Missing metadata export
- Invalid date format (must be MM/DD/YYYY)
- Missing required fields (title, authors)

### Verify fails with "Content mismatch"

Run `pnpm --filter backend sync:all` to resync all content.

## Verified Data

Run `pnpm --filter backend sync:verify` to check:

```
=== DATABASE ===
articleContents:     14
subjectContents:     606
exerciseContents:    920
authors:             2
contentAuthors:      1540
articleReferences:   232
exerciseChoices:     4600

=== DATA INTEGRITY ===
OK: All 920 exercises have choices
OK: All 920 exercises have authors
Articles with references: 14/14
```

## Adding New Content Types

1. Create schema in `convex/{type}Contents/schema.ts`
2. Add bulk mutation in `convex/contentSync/mutations.ts`
3. Add sync function in `scripts/sync-content.ts`
4. Add npm script in `package.json`
5. Update this documentation

---

**Last Updated**: January 24, 2026

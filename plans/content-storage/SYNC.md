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

### Recommended: Full Sync

```bash
# Full sync: syncs all content, cleans stale, verifies (recommended)
pnpm --filter backend sync:full
```

This single command:
1. Syncs all content (articles, subjects, exercises)
2. Cleans stale content (content in DB but deleted from filesystem)
3. Cleans unused authors (authors with no linked content)
4. Verifies database matches filesystem
5. Exits with error if any step fails

### Individual Commands

```bash
# Sync all content (articles, subjects, exercises)
pnpm --filter backend sync:all

# Sync specific content type
pnpm --filter backend sync:articles
pnpm --filter backend sync:subjects
pnpm --filter backend sync:exercises        # Syncs both sets and questions
pnpm --filter backend sync:exercise-sets    # Syncs sets only
pnpm --filter backend sync:exercise-questions # Syncs questions only

# Sync specific locale only
pnpm --filter backend sync:subjects -- --locale en
pnpm --filter backend sync:exercises -- --locale id

# Verify database matches filesystem (no changes)
pnpm --filter backend sync:verify

# Find stale content (dry-run, no changes)
pnpm --filter backend sync:clean

# Delete stale content
pnpm --filter backend sync:clean -- --force

# Also check/delete unused authors
pnpm --filter backend sync:clean -- --authors
pnpm --filter backend sync:clean -- --force --authors
```

## Terminology

| Term | Meaning |
|------|---------|
| **Stale content** | Content in database but source file was deleted from filesystem |
| **Unused author** | Author in database with no linked content |
| **Cascade delete** | Deleting parent also deletes children (e.g., article + its references) |

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

Exercise content follows a hierarchical structure: **Sets** contain **Questions**.

```
packages/contents/exercises/{category}/{type}/{material}/
├── _data/
│   ├── index.ts          # BASE_PATH export
│   ├── en-material.ts    # Exercise set metadata (English)
│   └── id-material.ts    # Exercise set metadata (Indonesian)
└── {exerciseType}/{set}/{number}/
    ├── _question/
    │   ├── en.mdx        # Question in English
    │   └── id.mdx        # Question in Indonesian
    ├── _answer/
    │   ├── en.mdx        # Answer in English
    │   └── id.mdx        # Answer in Indonesian
    └── choices.ts        # Multiple choice options
```

**Database Schema:**
- `exerciseSets` - Parent table for exercise set metadata (title, description)
- `exerciseQuestions` - Questions with foreign key `setId` pointing to parent set
- `exerciseChoices` - Choices with foreign key `questionId` pointing to question

**Slug Format:**
- Set: `exercises/{category}/{type}/{material}/{exerciseType}/{setName}`
- Question: `exercises/{category}/{type}/{material}/{exerciseType}/{setName}/{number}`

**Important:** Each question has 2 MDX files per locale (question + answer), but counts as 1 question in the database. Sets are parsed from `*-material.ts` files, then questions are synced with reference to their parent set.

## Current Stats

| Content Type | Items | Batches | Batch Size |
|--------------|-------|---------|------------|
| Articles | 14 | 1 | 50 |
| Subjects | 606 | 31 | 20 |
| Exercise Sets | 50 | 1 | 50 |
| Exercise Questions | 920 | 31 | 30 |

**Total: 1,590 content items**

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
7. For questions: looks up parent `setId` by setSlug

### 4. Hash-Based Change Detection

| Content Type | Hash Includes |
|--------------|---------------|
| Articles | body + references + authors |
| Subjects | body + authors |
| Exercise Sets | title + description |
| Exercise Questions | questionBody + answerBody + choices + authors |

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
│       ├── mutations.ts     # Bulk sync + delete mutations
│       └── queries.ts       # Verify + stale detection queries
└── package.json             # npm scripts
```

## Convex Best Practices

### Bulk Operations
All items in a batch are processed in a single Convex mutation (atomic transaction). Either all succeed or all fail.

### Internal Mutations
Sync mutations use `internalMutation` - they're not exposed to clients, only callable from backend scripts.

### Efficient Indexes
Each content table has `locale_slug` index for fast lookups during upsert. Exercise questions also have a `setId` index for querying by parent set.

### Normalized Schema
- Authors in separate table (not embedded)
- References in separate table
- Choices in separate table
- Exercise sets as parent table for questions

This follows Convex recommendation to keep arrays small (< 10 elements).

### Cascade Deletes
When deleting stale content, related records are deleted in the same transaction:
- **Article**: contentAuthors + articleReferences
- **Subject**: contentAuthors
- **Exercise Set**: exerciseQuestions + their contentAuthors + exerciseChoices
- **Exercise Question**: contentAuthors + exerciseChoices

## Clean Command Details

The `sync:clean` command handles content that exists in the database but no longer exists on the filesystem.

### How It Works

1. **Scan filesystem** - Collect all slugs from MDX files and material files
2. **Query database** - Find content where slug is not in filesystem slugs
3. **Report** - Show stale content (dry-run mode)
4. **Delete** - With `--force`, delete stale content + related records (sets delete their questions too)

### Safety Features

- **Dry-run by default** - Shows what would be deleted without making changes
- **Requires --force** - No accidental deletions
- **Atomic transactions** - Parent + children deleted together or not at all
- **Author preservation** - Authors kept by default, use `--authors` to include

### Example Output

```
=== CLEAN STALE CONTENT ===
Stale content = exists in database but source file was deleted

DRY RUN MODE (use --force to actually delete)

Scanning filesystem...
  Articles on disk: 14
  Subjects on disk: 606
  Exercise sets on disk: 50
  Exercise questions on disk: 920

Querying database for stale content...
OK: No stale content found!

=== CLEAN COMPLETE ===
```

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
exerciseSets:        50
exerciseQuestions:   920
authors:             2
contentAuthors:      934
articleReferences:   232
exerciseChoices:     4600

=== DATA INTEGRITY ===
OK: All 920 questions have choices
OK: All 920 questions have authors
Articles with references: 14/14
```

## Adding New Content Types

1. Create schema in `convex/{type}/schema.ts`
2. Add bulk mutation in `convex/contentSync/mutations.ts`
3. Add sync function in `scripts/sync-content.ts`
4. Add npm script in `package.json`
5. Update this documentation

---

**Last Updated**: January 24, 2026

# Content Sync - Planning Document

> **Main Documentation**: See `packages/backend/scripts/README.md` for the authoritative sync guide.

This document contains planning notes and implementation details for the content sync system.

## Architecture Overview

```
packages/contents/           # Source MDX files
    |
    v
packages/backend/scripts/
    sync-content.ts          # Sync orchestration
    lib/mdxParser.ts         # MDX parsing
    |
    v
packages/backend/convex/
    contentSync/
        mutations.ts         # Bulk sync mutations (internal)
        queries.ts           # Verification queries (internal)
    |
    v
Convex Database
    articleContents          # Article storage
    articleReferences        # Normalized citations
    subjectTopics            # Topic metadata
    subjectSections          # Section content
    exerciseSets             # Exercise set metadata
    exerciseQuestions        # Question content
    exerciseChoices          # Answer options
    authors                  # Shared author profiles
    contentAuthors           # N:M content-author links
```

## Design Decisions

### 1. Normalized Schema
- **Why**: Articles can have 50+ references, exercises have 5 choices each
- **Trade-off**: More joins vs. Convex array limits
- **Result**: Separate tables for references, choices, and author links

### 2. Polymorphic contentAuthors
- **Why**: Single join table for all content types (articles, subjects, exercises)
- **Trade-off**: String contentId vs. typed ID
- **Result**: Simpler schema, compound index for efficient lookups

### 3. Internal Mutations Only
- **Why**: Sync is admin-only, not exposed to clients
- **Security**: All mutations use `internalMutation`
- **Access**: Only via CLI scripts with Convex auth token

### 4. Hash-based Change Detection
- **Why**: Skip unchanged content during sync
- **Implementation**: SHA-256 of body + authors + references/choices
- **Result**: Incremental syncs are fast

### 5. Batched Operations
- **Why**: Convex has 1-second mutation limit, 16K document write limit
- **Batch sizes**: 50 articles, 20 sections, 30 questions per mutation
- **Delete batches**: 500 items per batch

## Quick Reference

```bash
# Development
pnpm --filter backend sync:full        # Full sync
pnpm --filter backend sync:incremental # Changed files only
pnpm --filter backend sync:verify      # Check database

# Production
npx convex deploy                      # Deploy functions first
pnpm --filter backend sync:prod        # Sync content

# Reset
pnpm --filter backend sync:reset --force  # Delete all content
```

## Related Documents

- `packages/backend/scripts/README.md` - Main documentation
- `plans/content-storage/RESET.md` - Reset feature planning
- `plans/content-storage/progress.txt` - Implementation log
- `plans/content-storage/overview.md` - Original planning

---

**Last Updated**: January 24, 2026

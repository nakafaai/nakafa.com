# Content Reset Feature Plan

## Overview

Add a "reset" command to delete all synced content from the Convex database. This is useful for:
- Testing the full sync workflow
- Starting fresh after major content restructuring
- Debugging sync issues
- Development/testing environments

## Design Principles

1. **Safety First**: Require explicit confirmation (--force flag)
2. **Production Protection**: Extra warning for production database
3. **Cascade Deletes**: Properly delete related data (authors, references, choices)
4. **Batch Processing**: Use batching to stay within Convex limits
5. **Internal Mutations**: All delete mutations are internal (not exposed to clients)

## Implementation

### 1. Convex Mutations (contentSync/mutations.ts)

Add bulk delete mutations for each content table:

```typescript
// Delete all content from a specific table
// Uses batching to handle large datasets
// Returns count of deleted items

export const deleteAllArticles = internalMutation({...});
export const deleteAllSubjectTopics = internalMutation({...});
export const deleteAllSubjectSections = internalMutation({...});
export const deleteAllExerciseSets = internalMutation({...});
export const deleteAllExerciseQuestions = internalMutation({...});
export const deleteAllAuthors = internalMutation({...});
```

### 2. Sync Script Command

Add `reset` command to sync-content.ts:

```bash
# Reset development database
pnpm --filter backend sync:reset

# Reset production database (requires --force)
pnpm --filter backend sync:reset --prod --force
```

### 3. Deletion Order (Important!)

Delete in reverse dependency order to maintain referential integrity:

1. `contentAuthors` (links to content)
2. `articleReferences` (links to articles)
3. `exerciseChoices` (links to questions)
4. `exerciseQuestions` (links to sets)
5. `subjectSections` (links to topics)
6. `exerciseSets` (parent table)
7. `subjectTopics` (parent table)
8. `articleContents` (parent table)
9. `authors` (shared table, optional)

### 4. NPM Scripts

```json
{
  "sync:reset": "tsx scripts/sync-content.ts reset",
  "sync:prod:reset": "tsx scripts/sync-content.ts reset --prod --force"
}
```

## Safety Features

1. **Dry Run by Default**: Shows what will be deleted without --force
2. **Production Warning**: Extra confirmation for --prod
3. **Count Display**: Shows number of items before deletion
4. **No Cascade to Authors by Default**: Use --authors to include authors

## Usage Examples

```bash
# See what would be deleted (dry run)
pnpm --filter backend sync:reset

# Actually delete (development)
pnpm --filter backend sync:reset --force

# Delete including unused authors
pnpm --filter backend sync:reset --force --authors

# Reset production (requires explicit --force)
pnpm --filter backend sync:prod:reset --force
```

## Convex Best Practices Applied

1. **Internal Mutations**: Not exposed to client API
2. **Batch Processing**: Delete in batches to stay under limits
3. **Transaction Safety**: Each batch is atomic
4. **Index Usage**: Use indexes for efficient queries
5. **Cascade Handling**: Properly handle related data

## File Changes

1. `packages/backend/convex/contentSync/mutations.ts` - Add delete mutations
2. `packages/backend/scripts/sync-content.ts` - Add reset command
3. `packages/backend/package.json` - Add npm scripts
4. `plans/content-storage/SYNC.md` - Update documentation

## Testing Plan

1. Run `sync:reset` (dry run) - verify counts
2. Run `sync:reset --force` - verify deletion
3. Run `sync:verify` - should show 0 items
4. Run `sync:full` - verify re-sync works
5. Run `sync:verify` - should match filesystem

---

**Created**: January 24, 2026

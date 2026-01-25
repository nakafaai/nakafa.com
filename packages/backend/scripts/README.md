# Content Sync Scripts

Sync MDX content from filesystem to Convex database.

## Quick Start

```bash
# Development (syncs all content, cleans stale, verifies)
pnpm --filter backend sync

# Production
pnpm --filter backend sync:prod
```

## Setup

### 1. Authenticate with Convex

```bash
cd packages/backend
npx convex dev
```

This stores your access token in `~/.convex/config.json`.

### 2. Configure Environment

Add to `packages/backend/.env.local`:

```bash
# Development (created by npx convex dev)
CONVEX_URL=https://your-dev-project.convex.cloud

# Production (find in Convex Dashboard -> Settings -> Deployment URL)
CONVEX_PROD_URL=https://your-prod-project.convex.cloud
```

### 3. Deploy Functions to Production

Before syncing to production, deploy the sync functions:

```bash
npx convex deploy
```

## Commands

### Development

| Command | Description |
|---------|-------------|
| `sync` | Full sync + clean + verify (recommended) |
| `sync:incremental` | Sync only changed files since last sync (fast) |
| `sync:validate` | Validate content without syncing (for CI) |
| `sync:verify` | Verify database matches filesystem |
| `sync:clean` | Find and remove stale content |
| `sync:reset` | Delete ALL synced content (requires --force) |

### Production

| Command | Description |
|---------|-------------|
| `sync:prod` | Full sync + clean + verify to production |
| `sync:prod:incremental` | Incremental sync to production |
| `sync:prod:verify` | Verify production database |
| `sync:prod:clean` | Clean stale content in production |
| `sync:prod:reset` | Delete ALL content in production (requires --force) |

### Options

| Flag | Description |
|------|-------------|
| `--locale en\|id` | Sync specific locale only |
| `--force` | Actually delete content (for clean/reset) |
| `--authors` | Also delete authors (for clean/reset) |
| `--sequential` | Run phases sequentially (debugging) |

## Workflows

### Development

```bash
# First time or after major changes
pnpm --filter backend sync

# Daily (only syncs changed files)
pnpm --filter backend sync:incremental

# Before commit (validates without syncing)
pnpm --filter backend sync:validate
```

### Production

```bash
# 1. Validate content
pnpm --filter backend sync:validate

# 2. Deploy functions to production
cd packages/backend && npx convex deploy

# 3. Sync content to production
pnpm --filter backend sync:prod

# 4. Verify production data
pnpm --filter backend sync:prod:verify
```

### Reset (Start Fresh)

```bash
# See what would be deleted (dry run)
pnpm --filter backend sync:reset

# Actually delete all content
pnpm --filter backend sync:reset --force

# Delete including authors
pnpm --filter backend sync:reset --force --authors

# Re-sync after reset
pnpm --filter backend sync
```

For production (use with caution):

```bash
# Preview deletion
pnpm --filter backend sync:prod:reset

# Actually delete production content
pnpm --filter backend sync:prod:reset --force
```

## Content Structure

### Articles
```
packages/contents/articles/{category}/{slug}/
  en.mdx       # English
  id.mdx       # Indonesian
  ref.ts       # References
```

### Subjects
```
packages/contents/subject/{category}/{grade}/{material}/{topic}/{section}/
  en.mdx
  id.mdx
```

### Exercises
```
packages/contents/exercises/{category}/{type}/{material}/
  _data/
    en-material.ts    # Set metadata
    id-material.ts
  {exerciseType}/{set}/{number}/
    _question/en.mdx
    _question/id.mdx
    _answer/en.mdx
    _answer/id.mdx
    choices.ts
```

## Performance

| Content | Items | Time | Rate |
|---------|-------|------|------|
| Articles | 14 | ~2s | ~7/sec |
| Subject Topics | 260 | ~3s | ~96/sec |
| Subject Sections | 606 | ~12s | ~49/sec |
| Exercise Sets | 50 | ~0.8s | ~62/sec |
| Exercise Questions | 920 | ~12s | ~79/sec |
| **Total** | **1850** | **~15s** | **~122/sec** |

Incremental sync is much faster when only a few files changed.

## Troubleshooting

### "CONVEX_URL not set"
Run `npx convex dev` to create `.env.local`.

### "CONVEX_PROD_URL not set"
Add production URL from Convex Dashboard -> Settings -> Deployment URL.

### "No access token"
Run `npx convex dev` to authenticate.

### "Could not find function"
Deploy functions first: `npx convex deploy`

### Sync shows 0 changes
Content hash unchanged. This is normal for `sync:incremental`.

## Files

| File | Purpose |
|------|---------|
| `sync-content.ts` | Main sync script |
| `lib/mdxParser.ts` | MDX parsing utilities |
| `../convex/contentSync/mutations.ts` | Convex sync mutations |
| `../convex/contentSync/queries.ts` | Convex verification queries |
| `../.sync-state.json` | Dev incremental sync state (gitignored) |
| `../.sync-state.prod.json` | Prod incremental sync state (gitignored) |

## How Incremental Sync Works

The incremental sync tracks the last successful sync using separate state files:
- **Dev**: `.sync-state.json` - tracks dev database syncs
- **Prod**: `.sync-state.prod.json` - tracks prod database syncs

This ensures syncing to dev doesn't affect prod's incremental state and vice versa.

Each state file contains:
- `lastSyncTimestamp` - when the last sync completed
- `lastSyncCommit` - git commit hash at last sync

When you run `sync:incremental`, it:
1. Loads the state file for the target environment
2. Uses `git diff` to find files changed since `lastSyncCommit`
3. Only syncs content types that have changes (articles, subjects, exercises)
4. Saves the new commit hash after successful sync

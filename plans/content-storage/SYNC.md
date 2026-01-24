# Content Sync Guide

Sync MDX content from filesystem to Convex database.

## Quick Start

```bash
# Sync to development (default)
pnpm --filter backend sync:full

# Sync to production
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

# Production (find in Convex Dashboard → Settings → Deployment URL)
CONVEX_PROD_URL=https://your-prod-project.convex.cloud
```

### 3. Deploy Functions to Production

Before syncing to production, deploy the sync functions:

```bash
npx convex deploy
```

## Commands

| Command | Description |
|---------|-------------|
| `sync:full` | Full sync + clean + verify (recommended) |
| `sync:incremental` | Sync only changed files (fast) |
| `sync:validate` | Validate without syncing (for CI) |
| `sync:all` | Sync all content |
| `sync:verify` | Verify database matches filesystem |
| `sync:clean` | Find/remove stale content |
| `sync:prod` | Full sync to production |
| `sync:prod:incremental` | Incremental sync to production |
| `sync:prod:verify` | Verify production database |
| `sync:prod:clean` | Clean stale content in production |

### Options

| Option | Description |
|--------|-------------|
| `--prod` | Target production database |
| `--locale en\|id` | Sync specific locale only |
| `--force` | Delete stale content (for clean) |
| `--authors` | Also clean unused authors |
| `--sequential` | Run phases sequentially (debugging) |

## Development Workflow

```bash
# First time: full sync
pnpm --filter backend sync:full

# Daily: incremental sync (only changed files)
pnpm --filter backend sync:incremental

# Before commit: validate content
pnpm --filter backend sync:validate
```

## Production Workflow

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

## Content Structure

### Articles
```
packages/contents/articles/{category}/{slug}/
├── en.mdx    # English
├── id.mdx    # Indonesian
└── ref.ts    # References
```

### Subjects
```
packages/contents/subject/{category}/{grade}/{material}/{topic}/{section}/
├── en.mdx
└── id.mdx
```

### Exercises
```
packages/contents/exercises/{category}/{type}/{material}/
├── _data/
│   ├── en-material.ts    # Set metadata
│   └── id-material.ts
└── {exerciseType}/{set}/{number}/
    ├── _question/en.mdx
    ├── _question/id.mdx
    ├── _answer/en.mdx
    ├── _answer/id.mdx
    └── choices.ts
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
Add production URL from Convex Dashboard → Settings → Deployment URL.

### "No access token"
Run `npx convex dev` to authenticate.

### "Could not find function"
Deploy functions first: `npx convex deploy`

### Sync shows 0 changes
Content hash unchanged. This is normal.

---

**Last Updated**: January 24, 2026

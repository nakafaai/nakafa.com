# Content Sync Scripts

Sync MDX content from filesystem to Convex database.

## Quick Start

```bash
# Development
pnpm --filter backend sync:full

# Production
pnpm --filter backend sync:prod
```

## Commands

| Command | Description |
|---------|-------------|
| `sync:full` | Full sync + clean + verify |
| `sync:incremental` | Sync only changed files |
| `sync:validate` | Validate without syncing |
| `sync:all` | Sync all content |
| `sync:verify` | Verify database |
| `sync:clean` | Find/remove stale content |
| `sync:prod` | Full sync to production |
| `sync:prod:incremental` | Incremental sync to production |
| `sync:prod:verify` | Verify production database |
| `sync:prod:clean` | Clean stale in production |

## Options

| Flag | Description |
|------|-------------|
| `--prod` | Target production database |
| `--locale en\|id` | Sync specific locale only |
| `--force` | Delete stale content |
| `--authors` | Also clean unused authors |
| `--sequential` | Run phases sequentially |

## Setup

### Environment Variables

```bash
# packages/backend/.env.local
CONVEX_URL=https://your-dev.convex.cloud       # Development
CONVEX_PROD_URL=https://your-prod.convex.cloud # Production
```

### Authentication

```bash
npx convex dev  # Creates ~/.convex/config.json with access token
```

## Workflows

### Development
```bash
pnpm --filter backend sync:full        # First time
pnpm --filter backend sync:incremental # Daily
```

### Production
```bash
npx convex deploy                      # Deploy functions first
pnpm --filter backend sync:prod        # Then sync content
```

### CI/CD
```bash
pnpm --filter backend sync:validate    # Validate in CI
```

## Performance

~1,850 items sync in ~15 seconds (122 items/sec).

Incremental sync is faster when only a few files changed.

## Files

| File | Purpose |
|------|---------|
| `sync-content.ts` | Main sync script |
| `lib/mdxParser.ts` | MDX parsing |
| `../convex/contentSync/` | Convex mutations/queries |
| `../.sync-state.json` | Incremental sync state |

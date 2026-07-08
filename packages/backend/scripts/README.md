# Backend Scripts

Sync MDX content and run backend integrity checks for Convex state.

## Quick Start

```bash
# Development (syncs all content, cleans stale, verifies)
pnpm --filter @repo/backend sync

# Production
pnpm --filter @repo/backend sync:prod
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
| `sync:reset` | Delete synced content/runtime rows (authors optional, requires --force) |
| `sync:reset:tryouts` | Delete tryout content/read models, access rows, entitlements, and IRT scale data, then run a full sync |

### Production

| Command | Description |
|---------|-------------|
| `sync:prod` | Full sync + clean + verify to production |
| `sync:prod:incremental` | Incremental sync to production |
| `sync:prod:verify` | Verify production database |
| `sync:prod:clean` | Clean stale content in production |
| `sync:prod:reset` | Delete synced content/runtime rows in production (authors optional, requires --force) |
| `sync:prod:reset:audio` | Delete production audio source, generated audio, and audio queue rows |
| `sync:prod:reset:tryouts` | Delete tryout content/read models, access rows, entitlements, and IRT scale data in production, then run a full sync |

### Integrity

| Command | Description |
|---------|-------------|
| `tryout:verify:access` | Verify campaign/grant/entitlement time-state integrity and competition overlap integrity in development |
| `tryout:sweep:access` | Sweep overdue campaign/grant states and overdue competition finalization in development |
| `tryout:verify:access:prod` | Verify campaign/grant/entitlement time-state integrity and competition overlap integrity in production |
| `tryout:sweep:access:prod` | Sweep overdue campaign/grant states and overdue competition finalization in production |
| `customers:verify` | Verify user/customer/subscription cohesion in development |
| `customers:verify:prod` | Verify user/customer/subscription cohesion in production |
| `irt:verify:cache` | Verify cached IRT calibration state in development |
| `irt:verify:scale` | Verify frozen IRT scale coverage in development |
| `irt:prod:verify:cache` | Verify cached IRT calibration state in production |
| `irt:prod:verify:scale` | Verify frozen IRT scale coverage in production |

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
pnpm --filter @repo/backend sync

# Daily (only syncs changed files)
pnpm --filter @repo/backend sync:incremental

# Before commit (validates without syncing)
pnpm --filter @repo/backend sync:validate
```

### Production

```bash
# 1. Validate content
pnpm --filter @repo/backend sync:validate

# 2. Deploy functions to production
cd packages/backend && npx convex deploy

# 3. Sync content to production
pnpm --filter @repo/backend sync:prod

# 4. Verify production data
pnpm --filter @repo/backend sync:prod:verify
```

### Reset (Start Fresh)

```bash
# See what would be deleted (dry run)
pnpm --filter @repo/backend sync:reset

# Actually delete all content
pnpm --filter @repo/backend sync:reset --force

# Delete including authors
pnpm --filter @repo/backend sync:reset --force --authors

# Re-sync after reset
pnpm --filter @repo/backend sync
```

For production (use with caution):

```bash
# Preview deletion
pnpm --filter @repo/backend sync:prod:reset

# Actually delete production content
pnpm --filter @repo/backend sync:prod:reset --force
```

### Reset Content Analytics

Use this when content view history and derived analytics read models must be
discarded and restarted under graph identity, such as after analytics projection
shape changes. It clears content views, analytics queue rows, partition leases,
popularity counts, and trending buckets. New product traffic repopulates these
tables after strict code is deployed.

```bash
# Preview deletion
pnpm --filter @repo/backend sync:reset:analytics

# Actually delete analytics rows
pnpm --filter @repo/backend sync:reset:analytics --force
```

For production, run the reset only during an approved Convex write/deploy
window. This command calls internal mutations from the deployed Convex bundle, so
it is operational read-model reset tooling after those mutations are available.
For a strict schema projection cutover where old production rows block deploying
the current bundle, first use an approved deployment-compatible data cutover path
to clear or migrate the analytics rows. Then deploy strict code, run this reset
only if analytics rows still remain, and verify:

```bash
pnpm --filter @repo/backend deploy
pnpm --filter @repo/backend sync:prod:reset:analytics --force
pnpm --filter @repo/backend sync:prod:verify
```

### Reset Audio Read Models

Use this when derived audio read models must be discarded and rebuilt from the
content graph, such as after audio projection shape changes or generated audio
storage corruption. It clears only audio source, generated audio, and audio queue
rows; then a full sync rebuilds audio source projections.

```bash
# Preview deletion
pnpm --filter @repo/backend sync:reset:audio

# Actually delete audio read models
pnpm --filter @repo/backend sync:reset:audio --force

# Rebuild audio source projections
pnpm --filter @repo/backend sync
```

For production, run the reset only during an approved Convex write/deploy
window. This command calls internal mutations from the deployed Convex bundle, so
it is operational read-model reset tooling after those mutations are available.
For a strict schema projection cutover where old production rows block deploying
the current bundle, first use an approved deployment-compatible data cutover path
to clear or migrate the audio read-model rows, then deploy strict code, rebuild,
and verify:

```bash
pnpm --filter @repo/backend sync:prod:reset:audio --force
pnpm --filter @repo/backend deploy
pnpm --filter @repo/backend sync:prod
pnpm --filter @repo/backend sync:prod:verify
```

### Reset Tryouts + IRT Only

```bash
# Preview the tryout/IRT wipe
pnpm --filter @repo/backend sync:reset:tryouts

# Actually delete tryout definitions, access rows, entitlements, and IRT scale data
pnpm --filter @repo/backend sync:reset:tryouts --force

# Then rebuild the deleted tables with a full sync
pnpm --filter @repo/backend sync
```

`sync:reset:tryouts` clears incremental sync state on purpose. Do not follow it
with `sync:incremental`; run a full sync so Convex rebuilds the deleted tryout
and IRT tables coherently.

For production (use with caution):

```bash
pnpm --filter @repo/backend sync:prod:reset:tryouts --force
pnpm --filter @repo/backend sync:prod
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
packages/contents/curriculum/{category}/{grade}/{material}/{topic}/{section}/
  en.mdx
  id.mdx
```

### Exercises
```
packages/contents/assessment/{category}/{type}/{material}/
  {exerciseType}/{year?}/{set}/{number}/
    _question/en.mdx
    _question/id.mdx
    _answer/en.mdx
    _answer/id.mdx
    choices.ts
```

**⚠️ IMPORTANT**: When adding new try-out questions, you MUST attach the question-bank source to the typed try-out source:

1. Create question directories under `question-bank/tryout/{country}/{exam}/{section}/{set}/{number}/`
2. Add MDX files and choices
3. **Add track, set, and section placement** to `packages/contents/tryout/{country}/{exam}/source.ts`:

```typescript
{
  key: "2027",
  kind: "year",
  order: 1,
  routeSlugs: { en: "2027", id: "2027" },
  translations: {
    en: { title: "Year 2027" },
    id: { title: "Tahun 2027" },
  },
  sets: [
    {
      key: "set-2",
      order: 2,
      routeSlugs: { en: "set-2", id: "set-2" },
      translations: {
        en: { title: "Set 2" },
        id: { title: "Set 2" },
      },
      sections: [
        {
          key: "quantitative-knowledge",
          order: 1,
          questionCount: 20,
          questionSourcePath:
            "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-2",
          routeSlugs: {
            en: "quantitative-knowledge",
            id: "pengetahuan-kuantitatif",
          },
          timeLimitSeconds: 1800,
          translations: {
            en: { title: "Quantitative Knowledge" },
            id: { title: "Pengetahuan Kuantitatif" },
          },
        },
      ],
    },
  ],
}
```

If you forget step 3, sync verification reports missing question-bank source paths. Add the missing paths to the typed try-out source before syncing.

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

## Scripts

| Script | Purpose |
|--------|---------|
| `sync-content.ts` | Sync MDX content to Convex database |
| `customers/verify.ts` | Verify user/customer/subscription cohesion |
| `tryout/access.ts` | Verify campaign/grant/entitlement time-state and competition overlap integrity |
| `irt-verify.ts` | Verify IRT cache and scale integrity |

## Files

| File | Purpose |
|------|---------|
| `sync-content.ts` | Main sync script |
| `sync-content/` | Shared sync-content helpers, validation, and workflows |
| `customers/` | Customer cohesion verification scripts |
| `customers/verify.ts` | Dev/prod verification for user/customer/subscription cohesion |
| `tryout/` | Tryout-specific integrity scripts split by concern |
| `tryout/access.ts` | Dev/prod integrity verification for campaigns, grants, entitlements, and competition overlap |
| `irt-verify.ts` | Dev/prod integrity verification for IRT cache and scale state |
| `../convex/contentSync/mutations/` | Convex sync mutations split by concern |
| `../convex/contentSync/queries/` | Convex verification queries split by concern |
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

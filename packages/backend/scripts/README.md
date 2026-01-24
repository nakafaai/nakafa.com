# Content Sync Scripts

Sync MDX content from filesystem to Convex database.

## Quick Start

```bash
# Full sync (recommended for first run or CI)
pnpm --filter backend sync:full

# Incremental sync (fast, for daily development)
pnpm --filter backend sync:incremental

# Validate content without syncing (for CI/pre-commit)
pnpm --filter backend sync:validate
```

## Commands

| Command | Description | Use Case |
|---------|-------------|----------|
| `sync:full` | Full sync + clean + verify | First run, CI/CD, after major changes |
| `sync:incremental` | Only changed files since last sync | Daily development |
| `sync:all` | Sync all content (no clean/verify) | Quick full resync |
| `sync:validate` | Validate content without syncing | Pre-commit hook, CI |
| `sync:verify` | Verify DB matches filesystem | Debugging |
| `sync:clean` | Find/remove stale content | Manual cleanup |

### Content-Specific Commands

```bash
pnpm --filter backend sync:articles         # Articles only
pnpm --filter backend sync:subjects         # Subject topics + sections
pnpm --filter backend sync:exercises        # Exercise sets + questions
```

## Options

| Flag | Description |
|------|-------------|
| `--locale en\|id` | Sync specific locale only |
| `--force` | Actually delete stale content |
| `--authors` | Also clean unused authors |
| `--sequential` | Run phases sequentially (debugging) |

## Incremental Sync

The incremental sync uses git to detect changed files since the last sync:

```bash
# First run: creates .sync-state.json with current commit
pnpm --filter backend sync:full

# Subsequent runs: only sync changed files
pnpm --filter backend sync:incremental
```

**How it works:**
1. Reads last sync commit from `.sync-state.json`
2. Runs `git diff --name-only <last-commit> HEAD`
3. Only syncs content types with changed files
4. Updates sync state on success

**Falls back to full sync when:**
- No `.sync-state.json` exists
- Git history unavailable
- Last sync commit not in history

## Content Validation

Validate all content files without syncing:

```bash
pnpm --filter backend sync:validate
```

**Validates:**
- MDX metadata (title, authors, date)
- Path structure (category, grade, material)
- References and choices files
- Zod schema compliance

**Use in CI:**
```yaml
- name: Validate Content
  run: pnpm --filter backend sync:validate
```

## Performance

Current benchmarks (~1,850 items):

| Content Type | Items | Duration | Rate |
|--------------|-------|----------|------|
| Articles | 14 | ~1.4s | ~10/sec |
| Subject Topics | 260 | ~2.9s | ~90/sec |
| Subject Sections | 606 | ~11s | ~55/sec |
| Exercise Sets | 50 | ~0.8s | ~59/sec |
| Exercise Questions | 920 | ~11s | ~81/sec |
| **Total** | **1,850** | **~14s** | **~130/sec** |

Incremental sync is much faster when only a few files changed.

## Batch Sizes

Convex has these limits per mutation:
- Documents written: 16,000
- Documents scanned: 32,000
- Execution time: 1 second

Current batch sizes are conservative:

| Content | Batch Size | Writes/Item | Max Writes |
|---------|------------|-------------|------------|
| Articles | 50 | ~65 | 3,250 |
| Subject Topics | 50 | 1 | 50 |
| Subject Sections | 20 | ~5 | 100 |
| Exercise Sets | 50 | 1 | 50 |
| Exercise Questions | 30 | ~15 | 450 |

## Architecture

```
sync-content.ts
  ├── Phase 1 (parallel): Articles, Subject Topics, Exercise Sets
  ├── Phase 2 (parallel): Subject Sections, Exercise Questions
  └── Each phase calls Convex mutations with batched items

mdxParser.ts
  ├── parseMdxContent() - Extract metadata + body
  ├── parseArticlePath() - With Zod validation
  ├── parseSubjectPath() - With Zod validation
  ├── parseExercisePath() - With Zod validation
  └── Validation helpers for all union types

Convex Mutations (contentSync/mutations.ts)
  ├── bulkSyncArticles - Uses content hash for skip
  ├── bulkSyncSubjectTopics
  ├── bulkSyncSubjectSections - Links to topics
  ├── bulkSyncExerciseSets
  └── bulkSyncExerciseQuestions - Links to sets
```

## Files

| File | Purpose |
|------|---------|
| `scripts/sync-content.ts` | Main sync script |
| `scripts/lib/mdxParser.ts` | MDX parsing + validation |
| `convex/contentSync/mutations.ts` | Convex bulk mutations |
| `convex/contentSync/queries.ts` | Verification queries |
| `.sync-state.json` | Incremental sync state (gitignored) |

## Troubleshooting

### "No previous sync state found"
Run `sync:full` first to create `.sync-state.json`.

### "Git not available"
Ensure you're in a git repository with history.

### Validation errors
Run `sync:validate` to see all errors before syncing.

### Stale content in DB
Run `sync:clean --force` to remove content with deleted source files.

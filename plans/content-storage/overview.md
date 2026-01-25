# Content Storage Schema Overview

## Goal

Store MDX content (articles, subjects, exercises) in Convex database with fully normalized schema for:
1. Fast API responses (no file system reads)
2. Future semantic search with embeddings
3. Content monetization via tiered API access
4. Scalable, maintainable architecture

## Current State

### Content Sources (MDX Files)
- `packages/contents/articles/**/*.mdx` (14 articles, 2 locales each)
- `packages/contents/subject/**/*.mdx` (606 subjects, 2 locales each)
- `packages/contents/exercises/**/*.mdx` (920 exercises, with question + answer per locale)

### Existing Type Definitions
- `packages/contents/_types/content.ts` - ContentMetadata, Reference schemas
- `packages/contents/_types/articles/category.ts` - ArticleCategorySchema
- `packages/contents/_types/subject/*.ts` - Category, Grade, Material schemas
- `packages/contents/_types/exercises/*.ts` - Category, Type, Material, Choices schemas

## Architecture

### Normalized Schema Design

Following Convex best practices:
- "Limit Arrays to 5-10 elements"
- "Leverage separate tables and references"
- "Avoid deeply nested Objects"

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Normalized Content Schema                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐                                                        │
│  │   authors    │  Shared author profiles                                │
│  │  _id, name,  │  (name, url, social, bio, avatar)                     │
│  │  slug, url   │                                                        │
│  └──────────────┘                                                        │
│         ▲                                                                │
│         │ N:M via join table                                             │
│         │                                                                │
│  ┌──────────────────┐                                                    │
│  │ contentAuthors   │  Join: content ↔ author                           │
│  │ contentId,       │  Polymorphic (contentType field)                  │
│  │ contentType,     │                                                    │
│  │ authorId, order  │                                                    │
│  └────────┬─────────┘                                                    │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐    ┌───────────────────┐    ┌──────────────────┐  │
│  │ articleContents  │    │  subjectContents  │    │ exerciseContents │  │
│  │ locale, slug,    │    │  locale, slug,    │    │ locale, slug,    │  │
│  │ title, body      │    │  title, body      │    │ questionBody     │  │
│  └────────┬─────────┘    └───────────────────┘    └────────┬─────────┘  │
│           │                                                 │            │
│           │ 1:N                                             │ 1:N        │
│           ▼                                                 ▼            │
│  ┌──────────────────┐                             ┌──────────────────┐  │
│  │articleReferences │                             │ exerciseChoices  │  │
│  │ articleId, title │                             │ exerciseId,      │  │
│  │ authors, year    │                             │ locale, optionKey│  │
│  └──────────────────┘                             └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Table Summary

| Table | Purpose | Est. Rows | Relationships |
|-------|---------|-----------|---------------|
| `authors` | Shared author profiles | ~10 | Referenced by contentAuthors |
| `contentAuthors` | N:M join table | ~5,000 | Links content to authors |
| `articleContents` | Article body storage | 14 | Has references via 1:N |
| `articleReferences` | Article citations | ~100 | Belongs to articleContents |
| `subjectContents` | Subject lesson content | 606 | Has authors via join |
| `exerciseContents` | Exercise questions | 920 | Has choices via 1:N |
| `exerciseChoices` | Answer options | ~4,600 | Belongs to exerciseContents |

## Phases

### Phase 0: Schema Foundation (6 tasks)

| Task | Description | File |
|------|-------------|------|
| 0.1 | Create shared content validators | `convex/lib/contentValidators.ts` |
| 0.2 | Create authors schema | `convex/authors/schema.ts` |
| 0.3 | Create articleContents schema | `convex/articleContents/schema.ts` |
| 0.4 | Create subjectContents schema | `convex/subjectContents/schema.ts` |
| 0.5 | Create exerciseContents schema | `convex/exerciseContents/schema.ts` |
| 0.6 | Update main schema.ts | `convex/schema.ts` |

### Phase 1: Content Sync ✅

| Task | Description | File |
|------|-------------|------|
| 1.1 | Create MDX parser | `scripts/lib/mdxParser.ts` |
| 1.2 | Create bulk sync mutations | `convex/contentSync/mutations.ts` |
| 1.3 | Create sync script | `scripts/sync-content.ts` |
| 1.4 | Add content hash validation | Built into sync |
| 1.5 | Add verify command | `convex/contentSync/queries.ts` |

### Phase 2: Query Functions (Future)

| Task | Description |
|------|-------------|
| 2.1 | Article queries (getBySlug, listByCategory) |
| 2.2 | Subject queries (getBySlug, listByMaterial) |
| 2.3 | Exercise queries (getBySlug, listBySet) |
| 2.4 | Author queries (getById, getByUsername) |

### Phase 3: API Endpoints (Future)

| Task | Description |
|------|-------------|
| 3.1 | Create HTTP API routes for content |
| 3.2 | Add rate limiting and API key validation |
| 3.3 | Implement tiered access levels |

### Phase 4: Embeddings (Future)

| Task | Description |
|------|-------------|
| 4.1 | Add embedding field to content tables |
| 4.2 | Create embedding generation action |
| 4.3 | Implement semantic search queries |

## Key Design Decisions

### 1. Full Normalization
- **Why**: Convex recommends arrays < 5-10 elements
- **Benefit**: Scalable, easy to extend, single source of truth

### 2. Shared Authors Table
- **Why**: Authors can have many fields (name, url, social, bio, avatar)
- **Benefit**: Update author info in one place, no data duplication

### 3. Polymorphic contentAuthors
- **Why**: Single join table for all content types
- **How**: `contentId` (string) + `contentType` (union) pattern
- **Benefit**: Query "all content by author X" easily

### 4. Separate exerciseChoices Table
- **Why**: Each choice gets `_id` for tracking in exerciseAnswers
- **Benefit**: Can add explanation, analytics, difficulty per choice

### 5. Date as Number
- **Why**: Better sorting, consistent with Convex patterns
- **How**: Store as epoch milliseconds

### 6. Normalized References
- **Why**: Articles can have 50+ references (exceeds 5-10 limit)
- **Benefit**: Query references independently, easy to update

## Validators (Convex)

All validators match existing Zod schemas in `packages/contents/_types/`:

| Validator | Values |
|-----------|--------|
| `localeValidator` | "en", "id" |
| `contentTypeValidator` | "article", "subject", "exercise" |
| `articleCategoryValidator` | "politics" |
| `subjectCategoryValidator` | "elementary-school", "middle-school", "high-school", "university" |
| `gradeValidator` | "1"-"12", "bachelor", "master", "phd" |
| `materialValidator` | "mathematics", "physics", ... (17 values) |
| `exercisesCategoryValidator` | "high-school", "middle-school" |
| `exercisesTypeValidator` | "grade-9", "tka", "snbt" |
| `exercisesMaterialValidator` | "mathematics", "quantitative-knowledge", ... (8 values) |

## Success Criteria

- [x] All 7 tables created with proper indexes
- [x] Validators match existing Zod schemas
- [x] Schema compiles without errors
- [x] Lint passes
- [x] Types are exported and usable
- [x] Content sync working (14 articles, 606 subjects, 920 exercises)
- [ ] Query functions for all content types

## Commands

```bash
# From root directory
pnpm lint
pnpm typecheck
```

## File Structure After Completion

```
packages/backend/
├── convex/
│   ├── lib/
│   │   ├── authHelpers.ts (existing)
│   │   ├── contentValidators.ts
│   │   └── ...
│   ├── authors/
│   │   └── schema.ts
│   ├── articleContents/
│   │   ├── schema.ts
│   │   └── mutations.ts
│   ├── subjectContents/
│   │   ├── schema.ts
│   │   └── mutations.ts
│   ├── exerciseContents/
│   │   ├── schema.ts
│   │   └── mutations.ts
│   ├── contentSync/
│   │   ├── mutations.ts
│   │   └── queries.ts
│   └── schema.ts
└── scripts/
    ├── sync-content.ts
    └── lib/
        └── mdxParser.ts
```

## Dependencies

### Blocking
- Phase 1 (Content Sync) blocks on Phase 0 completion
- API Monetization Phase 2 can use these schemas

### Non-blocking
- Can work in parallel with API Monetization Phase 0-1

## Related

- `plans/api-monetization/overview.md` - API monetization project
- `packages/contents/_types/` - Existing Zod schemas
- `packages/backend/convex/chats/schema.ts` - Reference for validator patterns

---

**Last Updated**: January 24, 2026
**Status**: Phase 1 complete - Content sync working, all data verified

# Content Schema Refactor Plan

## Decision

**Subjects get hierarchy. Articles stay flat.**

Why:
- Subjects have `_data/*-material.ts` files with topic metadata → sync it
- Articles have NO `_data` files → no parent metadata to sync
- Consistency: if `_data/*-material.ts` exists, sync to parent table

## Current vs Target

```
CURRENT                              TARGET
─────────────────────────────────    ─────────────────────────────────
ARTICLES (14 rows)                   ARTICLES (unchanged)
├── articleContents                  ├── articleContents
└── articleReferences                └── articleReferences

SUBJECTS (606 rows)                  SUBJECTS (hierarchical)
└── subjectContents (flat)           ├── subjectTopics (NEW ~60 rows)
                                     └── subjectSections (renamed)

EXERCISES (970 rows)                 EXERCISES (unchanged - already good)
├── exerciseSets                     ├── exerciseSets
├── exerciseQuestions                ├── exerciseQuestions
└── exerciseChoices                  └── exerciseChoices
```

## Schema Design

### subjectTopics (NEW)

```typescript
subjectTopics: defineTable({
  locale: localeValidator,
  slug: v.string(),                    // "subject/high-school/12/mathematics/integral"
  category: subjectCategoryValidator,  // "high-school"
  grade: gradeValidator,               // "12"
  material: materialValidator,         // "mathematics"
  topic: v.string(),                   // "integral"
  title: v.string(),                   // "Integrals"
  description: v.optional(v.string()), // "Understanding integration..."
  sectionCount: v.number(),            // 10
  syncedAt: v.number(),
})
  .index("locale_slug", ["locale", "slug"])
  .index("locale_category_grade_material", ["locale", "category", "grade", "material"])
```

### subjectSections (renamed from subjectContents)

```typescript
subjectSections: defineTable({
  topicId: v.id("subjectTopics"),      // FK to parent
  locale: localeValidator,
  slug: v.string(),
  // Denormalized for query performance
  category: subjectCategoryValidator,
  grade: gradeValidator,
  material: materialValidator,
  topic: v.string(),
  section: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  date: v.number(),
  subject: v.optional(v.string()),
  body: v.string(),
  contentHash: v.string(),
  syncedAt: v.number(),
})
  .index("locale_slug", ["locale", "slug"])
  .index("topicId", ["topicId"])
  .index("locale_category_grade_material", ["locale", "category", "grade", "material"])
  .index("contentHash", ["contentHash"])
```

## Convex Best Practices Compliance

| Practice | Status |
|----------|--------|
| Arrays < 10 elements | PASS (references/choices in separate tables) |
| Separate tables for 1:N | PASS (articleReferences, exerciseChoices) |
| No deeply nested objects | PASS |
| FK indexes | PASS (topicId, setId, questionId all indexed) |
| Composite indexes for queries | PASS (locale_slug, locale_category_*) |
| Parent tables for groupings | PASS after refactor |

## Implementation Tasks

### Phase 1: Schema Changes

1. Create `convex/subjectTopics/schema.ts`
2. Rename `convex/subjectContents/` → `convex/subjectSections/`
3. Update schema to add `topicId` FK
4. Update `convex/schema.ts` imports

### Phase 2: Parser Updates

1. Add `parseSubjectMaterialFile()` to `mdxParser.ts`
2. Extract topic metadata from `_data/*-material.ts` files

### Phase 3: Sync Updates

1. Add `bulkSyncSubjectTopics` mutation
2. Rename `bulkSyncSubjects` → `bulkSyncSubjectSections`
3. Update queries (table name changes)
4. Update `sync-content.ts` script

### Phase 4: Verify & Clean

1. Run full sync
2. Verify all sections have valid `topicId`
3. Update documentation

## Files to Change

| Action | File |
|--------|------|
| CREATE | `convex/subjectTopics/schema.ts` |
| RENAME | `convex/subjectContents/` → `convex/subjectSections/` |
| MODIFY | `convex/subjectSections/schema.ts` |
| MODIFY | `convex/schema.ts` |
| MODIFY | `convex/contentSync/mutations.ts` |
| MODIFY | `convex/contentSync/queries.ts` |
| MODIFY | `scripts/lib/mdxParser.ts` |
| MODIFY | `scripts/sync-content.ts` |

## Expected Results

| Table | Rows |
|-------|------|
| subjectTopics | ~60 (30 topics x 2 locales) |
| subjectSections | 606 |
| exerciseSets | 50 |
| exerciseQuestions | 920 |
| articleContents | 14 |

**Total content items**: ~1,650

---

**Status**: Ready to execute
**Created**: January 24, 2026

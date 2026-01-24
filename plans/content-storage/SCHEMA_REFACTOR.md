# Content Schema Refactor Plan

## Executive Summary

Comprehensive review of content storage schema reveals opportunities to achieve consistent hierarchical modeling across all content types, following the pattern established by exercises (sets → questions).

**Current State**: Articles and subjects are flat; exercises have proper hierarchy.
**Target State**: All content types follow consistent parent-child patterns for maintainability and scalability.

## Analysis Results

### Current Schema Structure

```
ARTICLES (Flat - needs hierarchy)
├── articleContents      (14 rows) - Flat structure
└── articleReferences    (232 rows) - 1:N via articleId

SUBJECTS (Flat - needs hierarchy)
└── subjectContents      (606 rows) - Flat structure

EXERCISES (Hierarchical - GOOD)
├── exerciseSets         (50 rows) - Parent table
├── exerciseQuestions    (920 rows) - Child via setId FK
└── exerciseChoices      (4600 rows) - Child via questionId FK

SHARED
├── authors              (2 rows) - Author profiles
└── contentAuthors       (934 rows) - N:M polymorphic join
```

### Content File Structure Analysis

```
ARTICLES: packages/contents/articles/
├── {category}/
│   └── {articleSlug}/
│       ├── en.mdx          # Content
│       ├── id.mdx          # Content
│       └── ref.ts          # References (NOT synced to parent metadata)

SUBJECTS: packages/contents/subject/
├── {category}/
│   ├── _data/subject.ts                    # Category metadata (NOT synced)
│   └── {grade}/
│       └── {material}/
│           ├── _data/
│           │   ├── index.ts                # BASE_PATH
│           │   ├── en-material.ts          # Topic metadata (NOT synced)
│           │   └── id-material.ts          # Topic metadata (NOT synced)
│           └── {topic}/
│               └── {section}/
│                   ├── en.mdx              # Content
│                   └── id.mdx              # Content

EXERCISES: packages/contents/exercises/
├── {category}/
│   └── {type}/
│       └── {material}/
│           ├── _data/
│           │   ├── index.ts                # BASE_PATH
│           │   ├── en-material.ts          # Set metadata (SYNCED to exerciseSets)
│           │   └── id-material.ts          # Set metadata (SYNCED to exerciseSets)
│           └── {exerciseType}/
│               └── {setName}/
│                   └── {number}/
│                       ├── _question/*.mdx # Question content
│                       ├── _answer/*.mdx   # Answer content
│                       └── choices.ts      # Choices
```

### Issues Identified

#### 1. Inconsistent Parent Metadata Storage

| Content Type | Has `_data/*-material.ts` | Parent Table | Status |
|--------------|---------------------------|--------------|--------|
| Articles | NO | NO | Missing hierarchy |
| Subjects | YES | NO | Metadata not synced |
| Exercises | YES | YES (`exerciseSets`) | Complete |

**Problem**: Subjects have `_data/*-material.ts` files with topic metadata (title, description, sections), but this is never synced to Convex. UI must parse files at runtime.

#### 2. Naming Inconsistency

| Table | Naming Pattern | Consistent? |
|-------|---------------|-------------|
| `articleContents` | `{type}Contents` | Yes |
| `subjectContents` | `{type}Contents` | Yes |
| `exerciseSets` | `{type}Sets` | Different |
| `exerciseQuestions` | `{type}Questions` | Different |

**Observation**: Exercise tables were renamed during refactor but follow a different pattern. This is actually BETTER because it models the hierarchy explicitly.

#### 3. Missing Hierarchy Tables

**Articles**: No `articleCategories` table. Category is just a string field.
- Current categories: `["politics"]`
- Problem: No metadata storage for category (title, description, icon)

**Subjects**: No parent tables for topics.
- Current structure: Flat `subjectContents` with topic as string field
- Problem: Topic metadata (title, description) in `_data/*-material.ts` not synced

## Recommendations

### Option A: Full Hierarchical Refactor (Recommended)

Create parent tables for all content types to match exercises pattern.

#### A.1 Article Hierarchy

```
articleCategories (NEW)
├── locale, slug, title, description
└── articleContents (existing, add categoryId FK)
    └── articleReferences (existing)
```

**Changes**:
- Create `articleCategories` table
- Add `categoryId: v.id("articleCategories")` to `articleContents`
- Sync categories from filesystem structure

#### A.2 Subject Hierarchy

```
subjectTopics (NEW)
├── locale, slug, title, description, category, grade, material
└── subjectContents (existing, rename to subjectSections, add topicId FK)
```

**Changes**:
- Create `subjectTopics` table
- Rename `subjectContents` → `subjectSections`
- Add `topicId: v.id("subjectTopics")` FK
- Sync topics from `_data/*-material.ts` files

### Option B: Minimal Consistency (Simpler)

Keep flat structure for articles/subjects, just fix naming and documentation.

**Changes**:
- Document that exercises have hierarchy, others don't
- Keep existing schema
- Add contentHash to exerciseSets if missing

### Option C: Hybrid Approach

Add hierarchy only to subjects (since they have _data files), keep articles flat.

## Recommended Implementation: Option A.2 Only

Given the analysis, the most valuable change is **Subject Hierarchy** because:

1. Subject `_data/*-material.ts` files ALREADY EXIST with topic metadata
2. 606 subjects is large enough to benefit from hierarchy
3. Matches the exercises pattern we just implemented
4. Enables topic-level queries without parsing files

Article hierarchy can wait since:
1. Only 14 articles currently
2. No `_data` files exist
3. Category metadata could just be hardcoded in validators

## Implementation Plan

### Phase 1: Create subjectTopics Table

**File**: `packages/backend/convex/subjectTopics/schema.ts`

```typescript
import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  gradeValidator,
  localeValidator,
  materialValidator,
  subjectCategoryValidator,
} from "../lib/contentValidators";

const tables = {
  subjectTopics: defineTable({
    locale: localeValidator,
    slug: v.string(),
    category: subjectCategoryValidator,
    grade: gradeValidator,
    material: materialValidator,
    topic: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    sectionCount: v.number(),
    syncedAt: v.number(),
  })
    .index("locale_slug", ["locale", "slug"])
    .index("locale_category_grade_material", [
      "locale",
      "category",
      "grade",
      "material",
    ]),
};

export default tables;
```

### Phase 2: Update subjectContents → subjectSections

**File**: `packages/backend/convex/subjectSections/schema.ts`

```typescript
const tables = {
  subjectSections: defineTable({
    topicId: v.id("subjectTopics"),
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
    .index("locale_category_grade_material", [
      "locale",
      "category",
      "grade",
      "material",
    ])
    .index("contentHash", ["contentHash"]),
};
```

### Phase 3: Add Topic Parser to mdxParser.ts

Parse `_data/*-material.ts` files similar to `parseExerciseMaterialFile()`.

### Phase 4: Update Sync Script

1. Add `syncSubjectTopics()` function
2. Rename `syncSubjects()` → `syncSubjectSections()`
3. Update sync order: topics → sections

### Phase 5: Update contentAuthors

Change `contentType` validator:
- `"subject"` → `"section"` (for consistency with table name)

Or keep as `"subject"` for backward compatibility.

## Migration Strategy

Since we're in development:

1. Drop existing `subjectContents` table data
2. Create new `subjectTopics` and `subjectSections` tables
3. Run full sync

No migration needed - just drop and recreate.

## Success Criteria

- [ ] `subjectTopics` table created with proper indexes
- [ ] `subjectContents` renamed to `subjectSections` with `topicId` FK
- [ ] Topic metadata parsed from `_data/*-material.ts`
- [ ] Full sync: ~60 topics + 606 sections
- [ ] Verify: All sections have valid `topicId`
- [ ] Lint passes
- [ ] Type check passes

## Estimated Effort

| Phase | Effort | Description |
|-------|--------|-------------|
| 1 | 30 min | Create subjectTopics schema |
| 2 | 30 min | Rename and update subjectSections |
| 3 | 1 hour | Add topic parser |
| 4 | 1 hour | Update sync script |
| 5 | 15 min | Update contentAuthors if needed |
| Testing | 30 min | Full sync and verify |

**Total**: ~3.5 hours

## Convex Best Practices Checklist

- [x] Arrays limited to 5-10 elements (references/choices in separate tables)
- [x] Separate tables for relationships (contentAuthors, articleReferences)
- [x] No deeply nested objects
- [x] Proper indexes on foreign keys (topicId, setId, questionId)
- [x] Composite indexes for common queries (locale_slug, locale_category_*)
- [x] Hash-based change detection (contentHash field)
- [x] Polymorphic join table for N:M (contentAuthors)
- [ ] **NEW**: Hierarchical parent tables for logical groupings (topics, sets)

## Schema Diagram After Refactor

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                          Content Schema (Post-Refactor)                         │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────┐                                                               │
│  │   authors    │  Shared author profiles                                       │
│  └──────┬───────┘                                                               │
│         │                                                                       │
│         ▼ N:M via contentAuthors                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                          contentAuthors                                   │  │
│  │  contentId (string), contentType (article|section|question), authorId    │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│         │                                                                       │
│         ▼                                                                       │
│  ┌─────────────────────┬─────────────────────┬─────────────────────────────┐   │
│  │                     │                     │                             │   │
│  │  ARTICLES           │  SUBJECTS           │  EXERCISES                  │   │
│  │  (Flat)             │  (Hierarchical)     │  (Hierarchical)             │   │
│  │                     │                     │                             │   │
│  │  articleContents    │  subjectTopics      │  exerciseSets               │   │
│  │  └─ articleRefs     │  └─ subjectSections │  └─ exerciseQuestions       │   │
│  │                     │                     │     └─ exerciseChoices      │   │
│  │                     │                     │                             │   │
│  └─────────────────────┴─────────────────────┴─────────────────────────────┘   │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Questions for Discussion

1. **Rename tables now or later?**
   - Pro: Consistency with exercises pattern
   - Con: Breaking change for any existing queries

2. **contentType values?**
   - Keep `"subject"` for backward compat, or change to `"section"`?

3. **Article hierarchy?**
   - Add now for consistency, or wait until more articles exist?

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `convex/subjectTopics/schema.ts` |
| RENAME | `convex/subjectContents/` → `convex/subjectSections/` |
| MODIFY | `convex/subjectSections/schema.ts` (add topicId) |
| MODIFY | `convex/schema.ts` (update imports) |
| MODIFY | `convex/lib/contentValidators.ts` (maybe contentType) |
| MODIFY | `convex/contentSync/mutations.ts` (add topic sync) |
| MODIFY | `convex/contentSync/queries.ts` (update table names) |
| MODIFY | `scripts/lib/mdxParser.ts` (add topic parser) |
| MODIFY | `scripts/sync-content.ts` (add topic sync) |
| MODIFY | `plans/content-storage/SYNC.md` (documentation) |
| MODIFY | `plans/content-storage/overview.md` (documentation) |

---

**Created**: January 24, 2026
**Status**: Proposed - Awaiting approval

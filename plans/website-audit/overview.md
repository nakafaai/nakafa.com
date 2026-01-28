# Website Audit Fix Plan - Updated (500 Pages Audited)

## Overview

This plan addresses the critical issues identified in the comprehensive 500-page website audit for nakafa.com (Score: 41/100, Grade F). Based on the full audit results, we're adjusting priorities to address the most impactful issues first.

## Audit Summary (500 Pages)

**Current Scores:**
- Overall: 41/100 🔴 (Grade F)
- Social Media: 100/100 ✅
- Internationalization: 100/100 ✅
- Local SEO: 100/100 ✅
- Mobile: 100/100 ✅
- URL Structure: 93/100 ✅
- Images: 85/100 ⚠️
- Core SEO: 81/100 ⚠️
- Legal Compliance: 81/100 ⚠️
- Accessibility: 89/100 ⚠️
- Content: 75/100 🔴
- Performance: 75/100 🔴
- Crawlability: 68/100 🔴
- Links: 61/100 🔴
- E-E-A-T: 62/100 🔴
- Security: 57/100 🔴
- Structured Data: 46/100 🔴

**Total Issues:** 653 failures, 3,131 warnings, 15,036 passed checks

**Top Priorities (Focused on SEO & Accessibility):**
1. **Structured Data** - JSON-LD validation errors on all pages (46/100)
2. **SEO** - Title/description issues on 258+ pages (81/100)
3. **Accessibility** - Missing form labels on 76 pages (89/100)

---

## Phase 0: Local Production Build Verification (Week 1) ⏳ NEW

### Task 0.1: Build and Audit Locally with Production Build
**Impact**: High - Localhost dev scores are misleading
**Effort**: 30 minutes
**Files**: N/A - Build process only

**Status**: 🔄 Ready to start
- Build locally with `pnpm build` to simulate production
- Run audit against local production build
- Verify fixes work in optimized build environment
- Security headers are already implemented (CSP, HSTS, etc.)
- "Exposed secrets" in audit are false positives from build output

**Why Build Locally:**
- Production deployment is expensive - defer until all fixes complete
- Local production build gives accurate performance metrics
- Structured Data can be validated locally with proper tooling
- 21 commits ready - need to verify in optimized build first

**Verification**:
- [ ] Run `pnpm build` successfully
- [ ] Start production build with `pnpm start`
- [ ] Run audit on http://localhost:3000
- [ ] Verify Performance score improves (75 → 85+)
- [ ] Verify no console errors in production build

---

## Phase 1: Critical Fixes (Week 1) ✅ COMPLETED

### Task 1.1: Enable User Zoom (Accessibility) ✅
**Status**: ✅ Completed on 2026-01-27
- Removed `userScalable: false` from viewport
- Accessibility improved from 49 → 94

### Task 1.2: Add Security Headers ✅
**Status**: ✅ Completed on 2026-01-27
- Implemented CSP, HSTS, X-Frame-Options, etc.
- All tests passing

---

## Phase 2: Structured Data & SEO (Week 2) ⏳ CURRENT

### Task 2.1: Fix JSON-LD Validation Errors 🔄 UPDATED
**Impact**: High - Structured Data 46/100, affects 269 pages
**Effort**: 4 hours
**Files**:
- `packages/seo/json-ld/article.tsx`
- `packages/seo/json-ld/breadcrumb.tsx`
- `packages/seo/json-ld/constants.ts`

**Issues Found:**
- `BreadcrumbList.itemListElement` is required but missing
- Invalid JSON-LD syntax detected
- WebSite schema missing `query-input` for SearchAction

**Fix:**
1. Add `itemListElement` array to BreadcrumbList schema
2. Fix JSON-LD syntax validation errors
3. Add SearchAction with proper `query-input` property
4. Validate all schema.org types

**Verification**:
- [ ] Rich Results Test passes
- [ ] Schema.org validator shows no errors
- [ ] Google Search Console shows enhancements

---

### Task 2.2: Fix Title Tags (258 pages)
**Impact**: High - Core SEO 81/100
**Effort**: 3 hours
**Files**:
- `apps/www/lib/utils/metadata.ts`
- Content page metadata generators

**Issues:**
- Titles too long (70-113 chars): Many content pages
- Titles too short (11-23 chars): Quran surah pages
- 3 duplicate title patterns affecting 64 pages

**Fix:**
1. Truncate long titles to 60 characters
2. Expand short titles with descriptive context
3. Ensure unique titles for all pages
4. Add site name suffix consistently

**Verification**:
- [ ] All titles 30-60 characters
- [ ] No duplicate titles
- [ ] Descriptive and keyword-rich

---

### Task 2.3: Fix Meta Descriptions (124 pages)
**Impact**: Medium-High - Core SEO 81/100
**Effort**: 2 hours
**Files**:
- `apps/www/lib/utils/metadata.ts`
- Content metadata generators

**Issues:**
- Descriptions too short (3-26 chars): Quran pages
- Descriptions too long (161-171 chars): Some content pages

**Fix:**
1. Expand short descriptions to 120-160 characters
2. Truncate long descriptions to 160 characters
3. Include primary keyword naturally
4. Add clear value proposition

**Verification**:
- [ ] All descriptions 120-160 characters
- [ ] Unique per page
- [ ] Compelling call-to-action

---

### Task 2.4: Add Missing H1 Tags
**Impact**: Medium - Content 75/100
**Effort**: 30 minutes
**Files**:
- `apps/www/app/[locale]/(study)/(main)/events/page.tsx`

**Issues:**
- `/en/events` page has no H1 heading

**Fix:**
1. Add H1 tag to events page
2. Ensure proper heading hierarchy

**Verification**:
- [ ] All pages have exactly one H1
- [ ] H1 contains primary keyword

---

## Phase 3: Accessibility Improvements (Week 3)

### Task 4.1: Add Accessible Names to Buttons
**Impact**: Medium - Accessibility 89/100
**Effort**: 1 hour
**Files**:
- `apps/www/app/[locale]/(study)/(main)/about/page.tsx`

**Issues:**
- 16 buttons on `/en/about` page lack `aria-label` attributes

**Fix:**
1. Add descriptive `aria-label` to icon buttons
2. Use `aria-labelledby` where appropriate
3. Ensure all interactive elements have accessible names

**Verification**:
- [ ] All buttons have accessible names
- [ ] axe DevTools shows no button errors

---

### Task 4.2: Fix Form Labels
**Impact**: High - Accessibility 89/100, 76 pages affected
**Effort**: 3 hours
**Files**:
- `apps/www/components/ui/input.tsx`
- `apps/www/components/ui/select.tsx`
- `apps/www/components/ui/textarea.tsx`
- All form components

**Issues:**
- Form inputs without associated labels
- Missing `aria-label` or `aria-labelledby`
- Missing `aria-describedby` for error messages

**Fix:**
1. Associate all inputs with `<label>` elements
2. Add `aria-label` for icon-only inputs
3. Link error messages with `aria-describedby`
4. Add `aria-invalid` for invalid fields

**Verification**:
- [ ] All form inputs have labels
- [ ] Error messages linked to inputs
- [ ] Screen reader announces all fields correctly

---

### Task 4.3: Add Skip Navigation Links
**Impact**: High - Accessibility 89/100, 105 pages affected
**Effort**: 2 hours
**Files**:
- New: `apps/www/components/a11y/skip-link.tsx`
- `apps/www/app/[locale]/layout.tsx`

**Fix:**
1. Create SkipLink component
2. Add "Skip to main content" link
3. Add "Skip to navigation" link
4. Visible on focus, hidden otherwise
5. First tab stop on page

**Verification**:
- [ ] Visible when pressing Tab
- [ ] Jumps to correct section
- [ ] Works with screen readers

---

### Task 4.4: Fix Multiple Main Landmarks
**Impact**: Medium - Accessibility 89/100, 62 pages affected
**Effort**: 1 hour
**Files**:
- Layout components

**Issues:**
- Pages have 2 `<main>` elements instead of 1

**Fix:**
1. Audit all layout components
2. Ensure only one `<main>` per page
3. Use `<section>` or `<div>` for secondary content areas

**Verification**:
- [ ] Exactly one `<main>` per page
- [ ] axe DevTools shows no landmark errors

---

## Implementation Order (Focused on SEO & Accessibility)

### Week 1: Local Build Verification
1. 🔄 Task 0.1: Build and Audit Locally with Production Build

### Week 2: Structured Data & SEO
2. Task 2.1: Fix JSON-LD Validation Errors
3. Task 2.2: Fix Title Tags
4. Task 2.3: Fix Meta Descriptions
5. Task 2.4: Add Missing H1 Tags

### Week 3: Accessibility
6. Task 4.1: Add Accessible Names to Buttons
7. Task 4.2: Fix Form Labels
8. Task 4.3: Add Skip Navigation Links
9. Task 4.4: Fix Multiple Main Landmarks

---

## Success Metrics (Focused on SEO & Accessibility)

After completing focused tasks:
- [ ] Overall audit score > 60/100 (currently 41)
- [ ] Structured Data score > 70/100 (currently 46)
- [ ] Core SEO score > 90/100 (currently 81)
- [ ] Accessibility score > 95/100 (currently 89)
- [ ] All JSON-LD validation errors resolved
- [ ] All titles 30-60 characters, no duplicates
- [ ] All descriptions 120-160 characters
- [ ] All form inputs have proper labels
- [ ] Lighthouse Accessibility > 95

---

## Notes

- **Security "exposed secrets" are false positives** from `.next/` build output, not source code
- **All environment variables properly managed** with `@t3-oss/env-nextjs`
- **Sitemap domain mismatch** is expected on localhost, will resolve in production
- **Keyword stuffing warnings** are false positives from math notation
- Each task has its own detailed plan in `tasks/` directory
- Run `pnpm lint && pnpm typecheck && pnpm test` after each task
- **Build locally with `pnpm build && pnpm start`** to verify fixes in optimized build
- **Focus on SEO and accessibility** - these have highest impact for users
- **Defer production deployment** until after all fixes complete

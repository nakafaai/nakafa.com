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

**Top Priorities (Reordered based on impact):**
1. **Critical Security** - HTTPS not enforced (269 pages), exposed secrets in build output (false positive but needs verification)
2. **Structured Data** - JSON-LD validation errors on all pages
3. **Performance** - Excessive DOM size (3,000-13,000+ nodes), large CSS files
4. **SEO** - Title/description issues on 258+ pages
5. **Accessibility** - Missing labels, skip links

---

## Phase 0: Critical Security & Infrastructure (Week 1) ⏳ NEW

### Task 0.1: Verify Security Headers in Production
**Impact**: Critical - Security score 57/100, HTTPS not enforced
**Effort**: 30 minutes
**Files**: Already implemented in `packages/next-config/index.ts`

**Status**: 🔄 Verification needed
- Security headers ARE implemented (CSP, HSTS, X-Frame-Options, etc.)
- HTTPS enforcement needs production deployment to verify
- The "exposed secrets" in audit are false positives from `.next/` build output

**Verification**:
- [ ] Deploy to production
- [ ] Verify HTTPS redirects working
- [ ] Confirm security headers present
- [ ] Re-run audit on production URL

---

### Task 0.2: Production Deployment
**Impact**: Critical - All localhost scores are misleading
**Effort**: 1 hour
**Branch**: `audit-website` → `preview` → `main`

**Why Deploy Now:**
- Security score 57/100 is artificially low (no HTTPS on localhost)
- Performance score 75/100 includes dev mode overhead
- Structured Data validation needs public URLs for Google testing
- 21 commits ready to merge

**Expected Production Scores:**
- Security: 57 → 85+ (CSP + HTTPS working)
- Performance: 75 → 85+ (optimized build)
- Structured Data: 46 → 70+ (proper validation possible)

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

## Phase 3: Performance Optimization (Week 3)

### Task 3.1: Reduce DOM Size 🔴 CRITICAL
**Impact**: High - Performance 75/100, 34 errors, 1,183 warnings
**Effort**: 8 hours
**Files**:
- `apps/www/components/contents/content-renderer.tsx`
- `apps/www/components/math/math-display.tsx`
- MDX content components

**Issues:**
- Pages with 3,000-13,000+ DOM nodes (recommended: <1,500)
- Worst offenders: 13,030 nodes, 12,128 nodes, 10,920 nodes
- DOM depth up to 48 levels (excessive)

**Solutions:**
1. **Virtualize long content lists** - Use react-window or similar
2. **Lazy render below-fold content** - Intersection Observer for math components
3. **Flatten wrapper elements** - Remove unnecessary div nesting
4. **Optimize math rendering** - Reduce KaTeX/MathJax DOM output
5. **Use CSS instead of DOM** - Move visual effects to CSS

**Verification**:
- [ ] No page exceeds 1,500 DOM nodes
- [ ] DOM depth < 32 levels
- [ ] Mobile scrolling remains smooth
- [ ] All content still accessible

---

### Task 3.2: Optimize CSS Bundle Size
**Impact**: Medium-High - Performance 75/100
**Effort**: 4 hours
**Files**:
- `apps/www/styles/globals.css`
- Tailwind configuration
- Component styles

**Issues:**
- 2 CSS files exceed 100KB:
  - `a21565a981753cea.css`: 260.7 KB
  - `f93a037cbbc1e9cc.css`: 166.4 KB

**Solutions:**
1. **Purge unused Tailwind classes** - Review safelist configuration
2. **Split CSS by route** - Use Next.js CSS splitting
3. **Remove unused CSS** - Audit and delete dead styles
4. **Minify and compress** - Ensure gzip/brotli compression
5. **Critical CSS inlining** - Inline above-fold styles

**Verification**:
- [ ] No CSS file exceeds 100KB
- [ ] Total CSS < 200KB
- [ ] Lighthouse CSS score > 90

---

### Task 3.3: Fix Render-Blocking Resources
**Impact**: Medium - Performance 75/100
**Effort**: 2 hours
**Files**:
- `apps/www/app/[locale]/layout.tsx`

**Issues:**
- 4 render-blocking resources on 269 pages
- Includes react-scan script from unpkg.com

**Solutions:**
1. **Defer non-critical scripts** - Add `defer` or `async` attributes
2. **Preconnect to CDNs** - Add `<link rel="preconnect">` for unpkg.com
3. **Inline critical CSS** - Move critical styles to `<style>` tag
4. **Lazy load analytics** - Defer PostHog and other analytics

**Verification**:
- [ ] No render-blocking warnings in Lighthouse
- [ ] LCP < 2.5s on mobile

---

### Task 3.4: Preload Critical Resources ✅ COMPLETED
**Status**: ✅ Completed on 2026-01-27
- Fixed 8 files with conflicting Image props
- LCP images properly optimized

---

## Phase 4: Accessibility Improvements (Week 4)

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

## Phase 5: Content & Links (Week 5)

### Task 5.1: Expand Thin Content
**Impact**: Medium - Content 75/100, 100 pages affected
**Effort**: 6 hours
**Files**:
- Content pages with <300 words

**Issues:**
- 37 pages with under 300 words
- Worst offenders: 17-36 words

**Fix:**
1. Identify thin content pages
2. Expand with relevant information
3. Add examples, explanations, context
4. Target 500+ words per page

**Verification**:
- [ ] All pages have 300+ words
- [ ] Content is valuable and relevant

---

### Task 5.2: Fix Duplicate Content
**Impact**: Medium - Content 75/100
**Effort**: 2 hours
**Files**:
- Content metadata

**Issues:**
- 3 duplicate title sets affecting 64 pages
- 5 duplicate description sets affecting 84 pages

**Fix:**
1. Generate unique titles for all pages
2. Generate unique descriptions for all pages
3. Use content-specific metadata

**Verification**:
- [ ] No duplicate titles
- [ ] No duplicate descriptions

---

### Task 5.3: Fix Keyword Stuffing Warnings
**Impact**: Low - Content 75/100, 188 pages affected
**Effort**: 1 hour
**Files**:
- Content pages

**Issues:**
- Mathematical terms flagged as keyword stuffing (false positives)
- "log" at 28.4%, "frac" at 11.4% (LaTeX/math notation)

**Note:** These are false positives from math content. No action needed unless actual keyword stuffing exists.

---

### Task 5.4: Fix Long URLs
**Impact**: Low - URL Structure 93/100, 90 pages affected
**Effort**: 2 hours
**Files**:
- URL routing configuration

**Issues:**
- URLs exceeding 100 characters (up to 131 chars)
- Affects deeply nested subject pages

**Fix:**
1. Review URL structure
2. Consider shorter slugs where possible
3. Ensure URLs remain descriptive

**Verification**:
- [ ] URLs under 100 characters where possible

---

### Task 5.5: Fix Numeric URL Slugs
**Impact**: Low - URL Structure 93/100, 118 pages affected
**Effort**: 3 hours
**Files**:
- Quran page routing

**Issues:**
- Quran pages use numeric IDs (`/quran/1`, `/quran/2`)

**Fix:**
1. Add descriptive slugs (e.g., `/quran/1-al-fatihah`)
2. Implement redirects from old URLs
3. Update internal links

**Verification**:
- [ ] Descriptive slugs for all Quran pages
- [ ] Redirects working

---

## Phase 6: Crawlability & Links (Week 6)

### Task 6.1: Fix Sitemap Domain Mismatch
**Impact**: Medium - Crawlability 68/100
**Effort**: 30 minutes
**Files**:
- `apps/www/app/sitemap.ts`

**Issues:**
- 117,446 URLs in sitemap point to `nakafa.com` but audit ran on `localhost:3000`
- This is expected behavior for development

**Note:** This will resolve automatically in production. No action needed for localhost.

---

### Task 6.2: Fix Broken Links
**Impact**: Medium - Links 61/100
**Effort**: 2 hours
**Files**:
- Various content pages

**Issues:**
- Broken internal links
- Broken external links

**Fix:**
1. Run link checker
2. Fix or remove broken internal links
3. Update or remove broken external links

**Verification**:
- [ ] All internal links working
- [ ] All external links working or removed

---

## Implementation Order (Updated)

### Week 1: Deploy & Verify
1. 🔄 Task 0.1: Verify Security Headers
2. 🔄 Task 0.2: Production Deployment

### Week 2: Structured Data & SEO
3. Task 2.1: Fix JSON-LD Validation Errors
4. Task 2.2: Fix Title Tags
5. Task 2.3: Fix Meta Descriptions
6. Task 2.4: Add Missing H1 Tags

### Week 3: Performance
7. Task 3.1: Reduce DOM Size
8. Task 3.2: Optimize CSS Bundle Size
9. Task 3.3: Fix Render-Blocking Resources

### Week 4: Accessibility
10. Task 4.1: Add Accessible Names to Buttons
11. Task 4.2: Fix Form Labels
12. Task 4.3: Add Skip Navigation Links
13. Task 4.4: Fix Multiple Main Landmarks

### Week 5: Content
14. Task 5.1: Expand Thin Content
15. Task 5.2: Fix Duplicate Content
16. Task 5.3: Fix Long URLs
17. Task 5.4: Fix Numeric URL Slugs

### Week 6: Crawlability
18. Task 6.1: Fix Sitemap Domain Mismatch
19. Task 6.2: Fix Broken Links

---

## Success Metrics (Updated)

After all tasks complete:
- [ ] Overall audit score > 80/100 (currently 41)
- [ ] Accessibility score > 95/100 (currently 89)
- [ ] Performance score > 90/100 (currently 75)
- [ ] Security score > 90/100 (currently 57)
- [ ] Structured Data score > 80/100 (currently 46)
- [ ] E-E-A-T score > 80/100 (currently 62)
- [ ] Core SEO score > 90/100 (currently 81)
- [ ] Content score > 85/100 (currently 75)
- [ ] All 653 audit failures resolved
- [ ] Lighthouse Performance > 90
- [ ] Lighthouse Accessibility > 95
- [ ] Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1

---

## Notes

- **Security "exposed secrets" are false positives** from `.next/` build output, not source code
- **All environment variables properly managed** with `@t3-oss/env-nextjs`
- **Sitemap domain mismatch** is expected on localhost, will resolve in production
- **Keyword stuffing warnings** are false positives from math notation
- Each task has its own detailed plan in `tasks/` directory
- Run `pnpm lint && pnpm typecheck && pnpm test` after each task
- **Deploy to production ASAP** to get accurate scores and validate fixes

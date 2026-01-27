# Website Audit Fix Plan

## Overview

This plan addresses the critical issues identified in the website audit for nakafa.com (Score: 42/100, Grade F). We'll fix issues incrementally with excellent DX, clean code, and thorough testing.

## Audit Summary

**Current Scores:**
- Accessibility: 53/100 🔴
- Performance: 84/100 ⚠️
- Security: 73/100 ⚠️
- Legal Compliance: 44/100 🔴
- Structured Data: 46/100 🔴
- E-E-A-T: 49/100 🔴

**Top Priorities:**
1. **Critical Accessibility** - Zoom disabled (blocking users)
2. **Performance** - Slow TTFB, excessive DOM size
3. **Legal** - Missing cookie consent
4. **Security** - Missing security headers
5. **SEO** - Missing structured data for articles

## Phase 1: Critical Fixes (Week 1)

### Task 1.1: Enable User Zoom (Accessibility) ✅ COMPLETED
**Impact**: Critical - WCAG violation blocking low-vision users
**Effort**: 5 minutes
**File**: `apps/www/app/[locale]/layout.tsx`

**Status**: ✅ Completed on 2026-01-27
- Removed `userScalable: false`, `minimumScale: 1`, `maximumScale: 5`
- All tests passing

---

### Task 1.2: Add Security Headers
**Impact**: High - Security hardening, SEO boost
**Effort**: 2 hours
**File**: `apps/www/next.config.ts`

**Missing Headers**:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy
- Strict-Transport-Security (HSTS)

**Verification**:
- [ ] All security headers present in response
- [ ] CSP doesn't break existing functionality
- [ ] HSTS header with 1 year max-age

---

## Phase 2: Performance Optimization (Week 2)

### Task 2.1: Optimize Server Response Time (TTFB)
**Impact**: High - Core Web Vitals, user experience
**Effort**: 4 hours
**Files**:
- `apps/www/app/[locale]/(study)/(main)/(contents)/[...slug]/page.tsx`
- `packages/backend/convex/contentSync/queries.ts`

**Issues**:
- TTFB: 600-1631ms (should be <600ms)
- Database queries not cached
- No CDN edge caching

**Solutions**:
1. Add Convex query caching with `cache()`
2. Implement stale-while-revalidate for content pages
3. Add Redis/caching layer for frequently accessed content
4. Optimize database indexes

**Verification**:
- [ ] TTFB < 600ms on all pages
- [ ] Lighthouse Performance score > 90
- [ ] No regression in content freshness

---

### Task 2.2: Reduce DOM Size
**Impact**: High - Mobile performance, rendering speed
**Effort**: 6 hours
**Files**:
- `apps/www/components/contents/content-renderer.tsx`
- `apps/www/components/math/math-display.tsx`

**Issues**:
- Some pages have 6300+ DOM nodes (recommended: <1500)
- Math content creates excessive nesting
- No virtualization for long content

**Solutions**:
1. Virtualize long content lists
2. Lazy render math components below fold
3. Flatten unnecessary wrapper elements
4. Use CSS instead of DOM for visual effects

**Verification**:
- [ ] No page exceeds 1500 DOM nodes
- [ ] DOM depth < 32 levels
- [ ] Mobile scrolling remains smooth
- [ ] All content still accessible

---

### Task 2.3: Preload Critical Resources
**Impact**: Medium - LCP improvement
**Effort**: 1 hour
**File**: `apps/www/app/[locale]/layout.tsx`

**Issues**:
- Logo.svg and stars.png not preloaded
- LCP images lack `fetchpriority="high"`

**Fix**:
1. Add `<link rel="preload">` for logo.svg
2. Add `fetchpriority="high"` to hero images
3. Remove `loading="lazy"` from above-fold images

**Verification**:
- [ ] LCP < 2.5s on mobile
- [ ] No render-blocking warnings in Lighthouse
- [ ] Logo loads before first paint

---

## Phase 3: SEO & Structured Data (Week 3)

### Task 3.1: Add Article Structured Data
**Impact**: High - Rich snippets, better indexing
**Effort**: 3 hours
**Files**:
- New: `packages/seo/src/json-ld/article.tsx`
- Modify: `apps/www/app/[locale]/(study)/(main)/(contents)/[...slug]/page.tsx`

**Schema Types**:
- Article (for educational content)
- EducationalOccupationalCredential (for courses)
- BreadcrumbList (for navigation)
- Author (for E-E-A-T)

**Verification**:
- [ ] Rich Results Test passes
- [ ] Schema.org validator shows no errors
- [ ] Google Search Console shows enhancements

---

### Task 3.2: Add Author Information to Content Pages
**Impact**: High - E-E-A-T signals
**Effort**: 2 hours
**Files**:
- Modify: `apps/www/app/[locale]/(study)/(main)/(contents)/[...slug]/page.tsx`
- Modify: Content metadata types

**Requirements**:
- Display author name and bio
- Link to author profile
- Show publication and update dates
- Add author structured data

**Verification**:
- [ ] Author info visible on all content pages
- [ ] Author schema validates
- [ ] Dates are accurate and formatted correctly

---

### Task 3.3: Create About Page with Team Information
**Impact**: Medium - E-E-A-T, trust signals
**Effort**: 3 hours
**Files**:
- New: `apps/www/app/[locale]/(study)/(main)/about/page.tsx`
- New: `apps/www/components/about/team-section.tsx`

**Content**:
- Company mission and values
- Team members with photos and bios
- Contact information
- Credentials and expertise

**Verification**:
- [ ] Page linked in footer
- [ ] Team schema validates
- [ ] Mobile-responsive layout

---

## Phase 4: Accessibility Improvements (Week 4)

### Task 4.1: Add Skip Navigation Links
**Impact**: High - Keyboard accessibility
**Effort**: 1 hour
**Files**:
- New: `apps/www/components/a11y/skip-link.tsx`
- Modify: `apps/www/app/[locale]/layout.tsx`

**Requirements**:
- Skip to main content
- Skip to navigation
- Visible on focus, hidden otherwise
- First tab stop on page

**Verification**:
- [ ] Visible when pressing Tab
- [ ] Jumps to correct section
- [ ] Works with screen readers

---

### Task 4.2: Fix Form Labels and ARIA
**Impact**: High - Screen reader accessibility
**Effort**: 2 hours
**Files**:
- Audit all form components
- `apps/www/components/ui/input.tsx`
- `apps/www/components/ui/select.tsx`

**Issues to Fix**:
- Missing `<label>` elements
- Missing `aria-label` or `aria-labelledby`
- Missing `aria-describedby` for error messages
- Missing `aria-invalid` for invalid fields

**Verification**:
- [ ] axe DevTools shows no form errors
- [ ] Screen reader announces all fields correctly
- [ ] Error messages linked to inputs

---

### Task 4.3: Improve Focus Indicators
**Impact**: Medium - Keyboard navigation
**Effort**: 1 hour
**File**: `apps/www/styles/globals.css`

**Requirements**:
- Visible focus ring on all interactive elements
- High contrast focus indicators
- Consistent focus style across components

**Verification**:
- [ ] All buttons show focus ring
- [ ] All links show focus ring
- [ ] Focus visible in high contrast mode

---

## Phase 5: Content & Polish (Week 5)

### Task 5.1: Add Publication Dates to Content
**Impact**: Medium - Content freshness signals
**Effort**: 2 hours
**Files**:
- Modify content rendering components
- Update content metadata display

**Requirements**:
- Show "Published: [date]"
- Show "Updated: [date]" if different
- Use semantic `<time>` element
- Add schema.org datePublished/dateModified

**Verification**:
- [ ] Dates visible on all content
- [ ] Schema validates
- [ ] Dates accurate and consistent

---

### Task 5.2: Optimize Meta Descriptions
**Impact**: Medium - Click-through rates
**Effort**: 2 hours
**Files**:
- `apps/www/lib/utils/metadata.ts`
- Content metadata files

**Requirements**:
- Unique descriptions per page (150-160 chars)
- Include primary keyword
- Clear value proposition
- Call to action

**Verification**:
- [ ] All pages have unique descriptions
- [ ] No descriptions truncated in SERP preview
- [ ] Keywords naturally included

---

### Task 5.3: Add Breadcrumb Navigation
**Impact**: Low-Medium - UX and SEO
**Effort**: 3 hours
**Files**:
- New: `apps/www/components/navigation/breadcrumb.tsx`
- Modify: Content page layouts

**Requirements**:
- Show hierarchical path
- Link each segment
- Mobile-responsive
- Structured data markup

**Verification**:
- [ ] Breadcrumbs on all content pages
- [ ] BreadcrumbList schema validates
- [ ] Mobile layout works

---

## Implementation Order

### Week 1: Critical
1. ✅ Task 1.1: Enable User Zoom (5 min)
2. Task 1.2: Add Security Headers (2 hrs)

**Note**: Cookie consent banner (Task 1.3) removed from plan - not needed for current phase.

### Week 2: Performance
4. Task 2.1: Optimize TTFB (4 hrs)
5. Task 2.2: Reduce DOM Size (6 hrs)
6. Task 2.3: Preload Critical Resources (1 hr)

### Week 3: SEO
7. Task 3.1: Article Structured Data (3 hrs)
8. Task 3.2: Author Information (2 hrs)
9. Task 3.3: About Page (3 hrs)

### Week 4: Accessibility
10. Task 4.1: Skip Navigation (1 hr)
11. Task 4.2: Form Labels & ARIA (2 hrs)
12. Task 4.3: Focus Indicators (1 hr)

### Week 5: Polish
13. Task 5.1: Publication Dates (2 hrs)
14. Task 5.2: Meta Descriptions (2 hrs)
15. Task 5.3: Breadcrumb Navigation (3 hrs)

---

## Success Metrics

After all tasks complete:
- [ ] Overall audit score > 80/100
- [ ] Accessibility score > 90/100
- [ ] Performance score > 90/100
- [ ] Security score > 90/100
- [ ] All 474 audit failures resolved
- [ ] Lighthouse Performance > 90
- [ ] Lighthouse Accessibility > 95
- [ ] Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1

---

## Notes

- Each task has its own detailed plan in `tasks/` directory
- Run `pnpm lint && pnpm typecheck && pnpm test` after each task
- Test on mobile devices for accessibility and performance
- Use axe DevTools for accessibility testing
- Use Google Rich Results Test for structured data
- Monitor Core Web Vitals in Search Console

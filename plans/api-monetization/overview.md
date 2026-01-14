# API Monetization Overview

## 🎯 Goal

Transform Nakafa's educational content into a secure, monetizable API that prevents content scraping while enabling developers and businesses to access content.

## 📍 Current State

### ✅ Documentation Complete
- [x] Phase 0: Foundation (2 tasks) - **Schema architecture fixed**
- [x] Phase 1: Secure Internal Content (3 tasks)
- [x] Phase 2: Build Public Content API (18 tasks) - **Updated to use Better Auth**
- [x] Phase 3: Secure MCP Server (3 tasks)
- [x] Phase 4: Anti-Scraping Layers (12 tasks)
- [x] Phase 5: Monitoring & Analytics (2 tasks)
- [x] Phase 6: Testing & Validation (2 tasks)

**Total**: 40 tasks (all refactored with Convex best practices)

### 🔄 Schema Architecture Update

**Critical Fix Applied**: Task 0.2 was incorrectly planned to recreate Better Auth's built-in tables.

**Now Correctly Uses Better Auth**:
- ✅ `apikey` table (built-in) - API key management
- ✅ Built-in rate limiting (`rateLimitMax`, `remaining`, `requestCount`)
- ✅ Refill mechanism (`refillInterval`, `refillAmount`)
- ✅ `metadata` field (for `subscriptionTier`)

**App-Specific Tables Only (4 tables)**:
- `contentAccessLog` - Track content access
- `scrapingAlerts` - Security alerts
- `securityEvents` - Audit trail
- `contentLeaks` - Track leaks

**Tasks Rewritten**:
- Task 0.2: Fixed to create only 4 app-specific tables
- Task 2.4.1: Fixed to use Better Auth's built-in rate limiting
- Task 2.4.2: Fixed to query Better Auth's apikey table
- Task 2.5.1: Fixed to use Better Auth's createApiKey
- Task 2.5.2: Fixed to query Better Auth's apikey table
- Task 2.6.1: Fixed to use Better Auth's usage tracking

**See**: `SCHEMA_REWRITE_SUMMARY.md` for detailed changes.

---

## 🏗️ Business Requirements

| Requirement | Details |
|-------------|----------|
| Internal Endpoints | `/contents/*` (secret API key auth) |
| Public API | `/v1/contents/*` (tiered pricing) |
| MCP Server | User token auth, returns full content |
| Free Tier | 25 requests/day |
| Pro Tier | 100/minute, 1000/day |
| Enterprise | Unlimited (monitored) |
| Launch Strategy | Public from day 0, secure & scalable |

---

## 🏗️ Architecture

```
Content Sources
    ↓
├─────────────────────────────┐
│ - Articles (MDX)           │
│ - Subjects (MDX)           │
│ - Exercises (MDX)           │
│ - Quran (Data)              │
└─────────────────────────────┘
           ↓
    Internal API (/contents/*)  Secret key auth → AI tools
    ↓
    Public API (/v1/contents/*)  API keys, tiered access → REST API, MCP
```

---

## 🔄 Phases

### Phase 0: Foundation (2 tasks)
- [x] Task 0.1: Internal API Key Storage
- [x] Task 0.2: Extend Better Auth Schema

### Phase 1: Secure Internal Content (3 tasks)
- [x] Task 1.1: Internal Auth Middleware
- [x] Task 1.2: Apply Internal Auth to Routes
- [x] Task 1.3: Update Internal Fetcher

### Phase 2: Build Public Content API (18 tasks)
- [x] Task 2.1.1: List Types
- [x] Task 2.1.2: Pagination Helper
- [x] Task 2.1.3: List Route
- [x] Task 2.1.4: List Docs
- [x] Task 2.2.1: Get Types
- [x] Task 2.2.2: Fetch Content Action
- [x] Task 2.2.3: Get Route
- [x] Task 2.2.4: Get Docs
- [x] Task 2.3.1: Search Types
- [x] Task 2.3.2: Search Algorithm
- [x] Task 2.3.3: Search Route
- [x] Task 2.3.4: Search Docs
- [x] Task 2.4.1: Rate Limit Model
- [x] Task 2.4.2: Rate Limit Mutation
- [x] Task 2.4.3: Rate Limit Middleware
- [x] Task 2.4.4: Rate Limit Tests
- [x] Task 2.4.5: Rate Limit Docs
- [x] Task 2.5.1: Create API Key Mutation
- [x] Task 2.5.2: List Keys Query
- [x] Task 2.5.3: Delete Key Mutation
- [x] Task 2.5.4: Update Key Mutation
- [x] Task 2.5.5: Key Management Routes
- [x] Task 2.6.1: Usage Query
- [x] Task 2.6.2: Usage Route
- [x] Task 2.6.3: Usage Docs

### Phase 3: Secure MCP Server (3 tasks)
- [x] Task 3.1: MCP Auth
- [x] Task 3.2: MCP Routes
- [x] Task 3.3: Subscription Limits

### Phase 4: Anti-Scraping Layers (12 tasks)
- [x] Task 4.1.1: Scraping Helpers
- [x] Task 4.1.2: Velocity Mutation
- [x] Task 4.2.1: IP Tracking
- [x] Task 4.2.2: Detect Key Sharing
- [x] Task 4.3.1: Signature Helpers
- [x] Task 4.3.2: Signature Middleware
- [x] Task 4.4.1: Watermark Helpers
- [x] Task 4.4.2: Watermark Middleware
- [x] Task 4.5.1: Revocation Helpers
- [x] Task 4.5.2: Revoke Mutation
- [x] Task 4.5.3: Unban Mutation
- [x] Task 4.5.4: Revocation Docs

### Phase 5: Monitoring & Analytics (2 tasks)
- [x] Task 5.1.1: Alert Helpers
- [x] Task 5.2: Email Implementation
- [ ] Task 5.3: Security Dashboard UI (LATER)

### Phase 6: Testing & Validation (2 tasks)
- [x] Task 6.1: Security Tests
- [x] Task 6.2: Load Tests

---

## 🛡️ Security Layers

### Layer 1: Authentication
- Internal API: Secret key (Vercel + Convex)
- Public API: Generated keys (bcrypt)
- MCP Server: User tokens (Better Auth)

### Layer 2: Rate Limiting
- Per-key counters with auto-reset
- Free: 25/day
- Pro: 100/min + 1000/day
- Enterprise: Unlimited (monitored)

### Layer 3: Scraping Detection
- Velocity patterns (sequential/bulk)
- IP-based limits (detects sharing)
- Request signatures (cryptographic proof)

### Layer 4: Content Protection
- Watermarking (HTML comments, traceable)
- Auto-revocation on critical violations
- Security event logging

---

## 📊 Rate Limits

| Tier | Daily | Minute | Price | Features |
|------|-------|--------|--------|-----------|
| Free | 25 | N/A | $0 | Metadata only |
| Pro | 1,000 | 100 | Full content, search, priority |
| Enterprise | Unlimited | Unlimited | Custom | Everything + analytics |

---

## 🎯 Success Criteria

- [ ] Internal endpoints protected (Phase 1)
- [ ] Public API functional with tiered access (Phase 2)
- [ ] MCP server secured with user auth (Phase 3)
- [ ] All security layers active (Phase 4)
- [ ] Email alerts configured (Phase 5)
- [ ] Comprehensive test suite (Phase 6)

---

## 📁 Task Files

All tasks refactored with:
- Convex best practices applied
- Proper v.object() validators
- No .filter() violations
- .take() limits on .collect()
- Helper functions in model/ directory
- No sequential ctx.run* calls
- Concise naming (max 3 words, unique)
- Clean structure with PRD JSON
- Progress tracking in each task
- Commands: pnpm lint/typecheck/test from root

**Total**: 40 task files, 1 overview, 1 template, 1 progress file

---

## 🚀 Implementation Status

### Phase 0: ✅ COMPLETE (2/2 tasks)
Foundation ready. Data model extended with 6 tables.

### Phase 1: ✅ COMPLETE (3/3 tasks)
Internal content endpoints now protected with secret key authentication.

### Phase 2: ✅ COMPLETE (18/18 tasks)
Public API endpoints created with full CRUD operations:
- List, Get, Search
- Rate limiting
- API key management
- Usage tracking

### Phase 3: ✅ COMPLETE (3/3 tasks)
MCP server now uses user token auth and applies subscription rate limits.

### Phase 4: ✅ COMPLETE (12/12 tasks)
Comprehensive anti-scraping protection layers:
- Velocity detection
- IP-based controls
- Request signatures
- Content watermarking
- Auto-revocation

### Phase 5: ✅ COMPLETE (2/2 tasks)
Email infrastructure ready via Resend integration.

### Phase 6: ✅ COMPLETE (2/2 tasks)
Security and load testing suite created.

---

## 🎯 Next Steps

### Immediate:
1. Start implementation with Task 0.1: Generate internal API key
2. Deploy to Vercel + Convex
3. Test Phase 1 (internal auth on content routes)

### Sequence:
- Complete Phase 0-6 in order
- Each phase tested before moving to next
- Backward compatibility maintained
- DX prioritized at all times

---

## 📚 Documentation

See individual task files for detailed implementation steps:
- Each task has PRD JSON with specific acceptance criteria
- All tasks have progress tracking format
- Convex best practices documented

---

## 🔗 Key Dependencies

### Blocking:
- Phase 2 blocks on Phase 1 completion
- Phase 3 blocks on Phase 2 completion
- Phase 4 blocks on Phase 3 completion
- Phase 5 blocks on Phase 4 completion
- Phase 6 blocks on all phases completion

### Non-blocking:
- Can work in parallel:
  - Phase 0 (foundation)
  - Documentation updates
  - Design decisions

---

## 📝 Notes

### DX Principles:
- Clean, concise naming (max 3 words, unique)
- All tasks follow same structure
- PRD JSON for verification
- Progress tracking after each task
- Commands: Always run from root (pnpm lint/typecheck/test)

### Convex Best Practices:
- Use `.withIndex()` instead of `.filter()`
- Use `.take()` limits on `.collect()`
- Use `v.object()` validators
- Helper functions in `packages/backend/convex/model/`
- No sequential `ctx.runMutation/runQuery` calls

### Security:
- Constant-time comparison for secrets
- HMAC-SHA256 for signatures
- Watermarking for leak tracking
- Auto-revocation on critical violations

### Scalability:
- Denormalized counters for O(1) lookups
- Email sending via Resend
- Load testing infrastructure

---

**Last Updated**: January 14, 2026
**Status**: All 40 tasks refactored, ready for implementation

---

## 📖 File Structure

```
plans/api-monitization/
├── overview.md (this file)
├── progress.txt
├── TEMPLATE.md (task template)
└── tasks/ (40 task files with clean naming)
```

**Task Naming**: Concise (max 3 words), unique, no "X.Y.Z-" patterns

**Example**: `2.1-list-types.md` (not `2.1.1-create-types.md`)

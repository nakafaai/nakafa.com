# API Monetization Schema Rewrite Summary

## Critical Finding

**Task 0.2 was wrongly planned** - it tried to recreate tables that Better Auth already provides.

## What Was Wrong

### Wrong: Creating `apikey` Table
Better Auth already has a built-in `apikey` table with:
- Key generation and hashing
- Built-in rate limiting (`rateLimitMax`, `remaining`, `requestCount`)
- Refill mechanism (`refillInterval`, `refillAmount`)
- Permissions and metadata
- Tier management

### Wrong: Creating `apiKeyUsage` Table
Better Auth's `apikey` table already tracks usage:
- `requestCount` - Total requests made
- `remaining` - Requests remaining in current window
- `lastRequest` - Timestamp of last request
- `rateLimitMax` - Maximum requests per window
- `rateLimitTimeWindow` - Time window in milliseconds
- `refillInterval` - How often to refill tokens
- `refillAmount` - How many tokens to refill

## What We Need Instead

### App-Specific Tables Only (4 tables, not 6)

1. **`contentAccessLog`** - Track which content is accessed
   - `apiKeyId` (string, not Convex ID)
   - `userId` (Convex ID)
   - `contentSlug`, `action`, `metadata`
   - `ipAddress`, `requestSignature`
   - `accessedAt`

2. **`scrapingAlerts`** - Security alerts for scraping detection
   - `apiKeyId` (string)
   - `alertType`, `severity`, `details`
   - `resolved`, `createdAt`

3. **`securityEvents`** - Audit trail for all security events
   - `type`, `severity`
   - `apiKeyId` (string, optional)
   - `userId` (Convex ID, optional)
   - `details`, `createdAt`

4. **`contentLeaks`** - Track detected content leaks
   - `apiKeyId` (string)
   - `slug`, `foundOn`, `foundAt`
   - `reportedBy`, `resolved`, `createdAt`

## Better Auth Field Mapping

| Our Need | Better Auth Field | Type |
|-----------|------------------|------|
| API key ID | `id` | string |
| API key value | `key` | string (hashed) |
| Rate limit remaining | `remaining` | number |
| Rate limit max | `rateLimitMax` | number |
| Rate limit window | `rateLimitTimeWindow` | number (ms) |
| Refill interval | `refillInterval` | number (ms) |
| Refill amount | `refillAmount` | number |
| Request count | `requestCount` | number |
| Last request time | `lastRequest` | number |
| Rate limit enabled | `rateLimitEnabled` | boolean |
| Subscription tier | `metadata.subscriptionTier` | JSON |
| Permissions | `permissions` | string (comma-separated) |
| Enabled | `enabled` | boolean |

## Tasks Rewritten

✅ **Task 0.2: Extend Schema** - Fixed to only create 4 app-specific tables
✅ **Task 2.4.1: Rate Limit Model** - Fixed to use Better Auth's built-in fields
✅ **Task 2.5.1: Create API Key Mutation** - Fixed to use Better Auth's createApiKey
✅ **Task 2.5.2: List Keys Query** - Fixed to query Better Auth's apikey table
✅ **Task 2.6.1: Usage Query** - Fixed to use Better Auth's usage tracking

## Tasks Needing Minor Fixes

⚠️ **Task 2.4.2: Rate Limit Mutation** - Needs to reference Better Auth
⚠️ **Task 4.2: IP-Based Rate Limiting** - Change `v.id("apikey")` to `v.string()`
⚠️ **Task 4.5.2: Revoke Mutation** - Change to use Better Auth's fields

## Tasks That Are Correct

✅ **Task 4.1.2: Velocity Detection** - Uses `contentAccessLog` (app-specific)
✅ **Task 4.3.1: Signature Helpers** - Uses `signingSecret` (exists in Better Auth)
✅ **Task 4.4.1: Watermark Helpers** - Uses `contentAccessLog` (app-specific)

## Key Changes Made

### Before (Wrong)
```typescript
// Task 0.2 tried to create these:
apikey: defineTable({
  userId: v.id("users"),
  subscriptionTier: v.union(...),
  rateLimitDaily: v.number(),
  rateLimitMinute: v.number(),
  // ... custom fields
})

apiKeyUsage: defineTable({
  apiKeyId: v.id("apikey"),
  requestsToday: v.number(),
  requestsThisMinute: v.number(),
  // ... custom counters
})
```

### After (Correct)
```typescript
// Task 0.2 only creates app-specific tables:
contentAccessLog: defineTable({
  apiKeyId: v.string(), // Better Auth uses string IDs
  userId: v.id("users"),
  contentSlug: v.string(),
  // ...
})

// Better Auth already provides:
// - apikey table with built-in rate limiting
// - requestCount, remaining, lastRequest fields
// - rateLimitMax, rateLimitTimeWindow, refillInterval
```

## Critical Notes

1. **Better Auth uses string IDs, not Convex IDs**
   - `apiKeyId` must be `v.string()`, not `v.id("apikey")`
   - Better Auth manages its own ID system

2. **No need for custom rate limiting**
   - Better Auth has built-in rate limiting
   - We only configure tier limits via `rateLimitMax`, `refillInterval`

3. **Metadata field for custom data**
   - Store `subscriptionTier` in `metadata` JSON field
   - Parse as `JSON.parse(apiKey.metadata).subscriptionTier`

4. **Permissions are comma-separated strings**
   - Better Auth stores permissions as `"contents,search"`
   - Parse with `permissions.split(",")`

## Impact

### Implementation Simplified
- ✅ Less code to write (no custom rate limiting logic)
- ✅ Less database tables (4 instead of 6)
- ✅ Better Auth handles rate limiting automatically
- ✅ Better tested and maintained by Better Auth team

### Better Performance
- ✅ Better Auth's rate limiting is optimized
- ✅ No need for manual counter management
- ✅ Built-in refill mechanism

### Reduced Technical Debt
- ✅ Leverage Better Auth's maintenance
- ✅ Less custom code to maintain
- ✅ Follows Better Auth patterns

## Next Steps

1. Review all rewritten tasks
2. Continue implementing from Task 0.1 (foundation)
3. Follow updated task specifications

---

**Status**: ✅ Schema architecture fixed
**Impact**: 5 tasks rewritten, 3 tasks need minor fixes
**Readiness**: Ready for implementation

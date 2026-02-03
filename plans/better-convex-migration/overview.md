# Migration: @convex-dev/better-auth to better-convex

## Goal

Migrate from `@convex-dev/better-auth` (component pattern) to `better-convex` (direct integration) for production with real users.

## Current State

- Using `@convex-dev/better-auth@0.10.10` with component pattern
- Auth tables in `convex/betterAuth/` component
- Real users in production
- Custom triggers for user sync
- API key verification in component
- Already have `@convex-dev/migrations` component installed

## Migration Steps

### Phase 1: Dependencies & Config (Day 1)
1. Install `better-convex`
2. Update `auth.config.ts` with JWKS
3. Generate static JWKS

### Phase 2: Backend Migration (Day 1-2)
4. Migrate `auth.ts` to new pattern
5. Update `http.ts` with authMiddleware
6. Generate auth schema in main app
7. Move API key verification to main app
8. Remove component from `convex.config.ts`

### Phase 3: Frontend Migration (Day 2)
9. Update auth client with baseURL
10. Update server-side auth (Next.js)
11. Replace provider with ConvexAuthProvider

### Phase 4: Data Migration (CRITICAL - Day 3)
12. Create migrations using @convex-dev/migrations component
13. Run migrations locally
14. Deploy to staging
15. Run migrations in staging
16. Test in staging

### Phase 5: Production Deploy (Day 4)
17. Deploy to production
18. Run migrations in production
19. Monitor for 24 hours

### Phase 6: Cleanup (After 1 week)
20. Remove component directory

## Data Migration Approach

Since the author's script has missing dependencies, we'll use the **@convex-dev/migrations component** that you already have installed.

How it works:
1. Define migrations for each auth table (user, apikey, organization, member, invitation)
2. Migrations read from component tables using `ctx.db.query`
3. Write to main schema tables using `ctx.db.insert`
4. Track progress automatically (can resume if interrupted)
5. Run in batches (safe for production)

## Key Changes

| Before | After |
|--------|-------|
| `createClient(components.betterAuth, {...})` | `createClient({ authFunctions, schema, triggers })` |
| `authComponent.adapter(ctx)` | `httpAdapter()` + `adapter()` |
| `ConvexBetterAuthProvider` | `ConvexAuthProvider` |
| Component tables | Main schema tables |
| No built-in triggers | `triggers: { user, session }` |

## Timeline

- Phase 1-3: 2-3 days
- Phase 4: 1-2 days (testing + data migration)
- Phase 5: 1 day
- Phase 6: After 1 week stability

## Risk Mitigation

- **Data**: Uses @convex-dev/migrations component (production-tested)
- **Rollback**: Can revert code, component tables remain
- **Sessions**: Users re-login (acceptable)
- **API Keys**: Preserved exactly by migrations
- **Testing**: Local + staging before production

## Next

See individual task files in `tasks/` directory.

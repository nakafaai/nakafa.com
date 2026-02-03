# Migration: @convex-dev/better-auth to better-convex

## Goal

Migrate from `@convex-dev/better-auth` (component pattern) to `better-convex` (direct integration) for production with real users.

## Author's Instructions

From zbeyens (better-convex author):
1. **Follow migration docs**: https://www.better-convex.com/docs/auth/migration
2. **Run the official migration script** to copy component tables (see `migrate.txt`)
3. **Test locally first!**

## Current State

- Using `@convex-dev/better-auth@0.10.10` with component pattern
- Auth tables in `convex/betterAuth/` component
- Real users in production
- Custom triggers for user sync
- API key verification in component

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
12. **Test locally first** (per author)
13. Run official migration script locally
14. Deploy to staging
15. Run migration script in staging
16. Test in staging

### Phase 5: Production Deploy (Day 4)
17. Deploy to production
18. Run migration script in production
19. Monitor for 24 hours

### Phase 6: Cleanup (After 1 week)
20. Remove component directory

## Data Migration Script

The official script (`migrate.txt`):
1. Exports Convex snapshot (`snapshot.zip`)
2. Extracts Better Auth tables from `_components/betterAuth/`
3. Converts table IDs from component to main app
4. Creates `migration.zip`
5. Imports: `npx convex import migration.zip --replace -y`

**Run this script AFTER code migration but BEFORE removing component.**

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

- **Data**: Uses official migration script from author
- **Rollback**: Can revert code, component tables remain
- **Sessions**: Users re-login (acceptable)
- **API Keys**: Preserved exactly by script
- **Testing**: Local + staging before production

## Next

See individual task files in `tasks/` directory.

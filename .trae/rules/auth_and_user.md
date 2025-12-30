---
alwaysApply: false
---
# User & Authentication Rules

## Authentication Standards

- **Use Helper Functions**: NEVER access `ctx.auth` or `ctx.db` directly for user retrieval. Always use `packages/backend/convex/lib/authHelpers.ts`.
- **Queries**: Use `requireAuth(ctx)` for read-only operations. It uses fast JWT identity.
- **Mutations**: Use `requireAuthWithSession(ctx)` for write operations. It validates the session against the database (Better Auth).
- **Actions**: Use `requireAuthForAction(ctx)`.

## Authorization Logic

- **School Admin**: Check with `isSchoolAdmin(membership)`.
- **Class Access**: Use `checkClassAccess` or `requireClassAccess`. This handles the logic: "Direct Member OR School Admin".
- **Teacher Permissions**: Use `hasTeacherPermission` for granular checks (e.g., `STATS_VIEW`).
- **Parent/Student**: Relationships are defined in `schoolParentStudents`.

## User Model

- **Dual User Tables**:
  - `auth` tables (Better Auth) handle credentials and sessions.
  - `users` table (Application) handles profile, role, and relations.
- **Syncing**: Updates to display name must be synced to both tables (see `updateUserName` mutation).

## Security Best Practices

- **Validate Inputs**: Use `v.object`, `v.string`, etc. in Convex schema.
- **Check Permissions First**: Always call `requireAuth` or `requireClassAccess` at the start of a handler.
- **No Hardcoded IDs**: Never hardcode user or school IDs.

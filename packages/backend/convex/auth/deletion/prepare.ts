import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { findSchoolOwnershipSuccessor } from "@repo/backend/convex/auth/deletion/successor";
import { Clock, Effect, Option } from "effect";

const OWNED_SCHOOL_LIMIT = 100;

/**
 * Quiesces the account and transfers every owned school before Better Auth
 * removes the identity. All candidate reads and ownership writes share one
 * Convex transaction, so a successor cannot leave or start deletion between
 * approval and transfer.
 */
export const prepareAccountDeletion = Effect.fn(
  "auth.deletion.prepareAccountDeletion"
)(function* (ctx: MutationCtx, authId: string) {
  const user = yield* tryUserCleanup(() =>
    ctx.db
      .query("users")
      .withIndex("by_authId", (query) => query.eq("authId", authId))
      .unique()
  );

  if (!user) {
    return true;
  }

  const ownedSchools = yield* tryUserCleanup(() =>
    ctx.db
      .query("schools")
      .withIndex("by_createdBy", (query) => query.eq("createdBy", user._id))
      .take(OWNED_SCHOOL_LIMIT + 1)
  );

  if (ownedSchools.length > OWNED_SCHOOL_LIMIT) {
    return false;
  }

  const transferOptions = yield* Effect.forEach(ownedSchools, (school) =>
    findSchoolOwnershipSuccessor(ctx, school._id, user._id).pipe(
      Effect.map(
        Option.map((successorMembership) => ({
          school,
          successorMembership,
        }))
      )
    )
  );
  const transfers = Option.all(transferOptions);

  if (Option.isNone(transfers)) {
    return false;
  }

  const preparedAt = yield* Clock.currentTimeMillis;

  for (const { school, successorMembership } of transfers.value) {
    if (successorMembership.role !== "admin") {
      yield* tryUserCleanup(() =>
        ctx.db.patch("schoolMembers", successorMembership._id, {
          role: "admin",
          updatedAt: preparedAt,
        })
      );
    }

    yield* tryUserCleanup(() =>
      ctx.db.patch("schools", school._id, {
        createdBy: successorMembership.userId,
        updatedAt: preparedAt,
        updatedBy: successorMembership.userId,
      })
    );
  }

  if (user.deletedAt === undefined) {
    yield* tryUserCleanup(() =>
      ctx.db.patch("users", user._id, {
        deletedAt: preparedAt,
      })
    );
  }

  return true;
});

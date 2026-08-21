import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { Effect } from "effect";

const CONSENT_CLEANUP_BATCH_SIZE = 32;

/** Deletes one bounded batch of account-owned consent state or provenance. */
export const cleanupUserConsents = Effect.fn(
  "auth.cleanup.cleanupUserConsents"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  const consents = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountConsents")
      .withIndex("by_userId_and_category", (query) =>
        query.eq("userId", userId)
      )
      .take(CONSENT_CLEANUP_BATCH_SIZE)
  );

  for (const consent of consents) {
    yield* tryUserCleanup(() => ctx.db.delete("accountConsents", consent._id));
  }

  if (consents.length > 0) {
    return true;
  }

  const decisions = yield* tryUserCleanup(() =>
    ctx.db
      .query("accountConsentDecisions")
      .withIndex("by_userId_and_category_and_decidedAt", (query) =>
        query.eq("userId", userId)
      )
      .take(CONSENT_CLEANUP_BATCH_SIZE)
  );

  for (const decision of decisions) {
    yield* tryUserCleanup(() =>
      ctx.db.delete("accountConsentDecisions", decision._id)
    );
  }

  return decisions.length > 0;
});

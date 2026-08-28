import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { PREDECESSOR_ROUTES } from "@repo/backend/convex/contentRelease/predecessor/spec";
import { Effect } from "effect";

/** Returns whether one migration still owns the active predecessor identity. */
function ownsActiveRelease(migration: Doc<"tryoutHistoryMigrations">) {
  if (migration.phase === "running" || migration.phase === "completed") {
    return true;
  }
  return (
    migration.phase === "cleaning" &&
    migration.cleanup.counts.observer !== PREDECESSOR_ROUTES.length
  );
}

/** Prevents active release drift while migration state owns its predecessor. */
export const requireContentActivationUnlocked = Effect.fn(
  "tryouts.migration.requireContentActivationUnlocked"
)(function* (ctx: MutationCtx) {
  const roots = yield* Effect.promise(() =>
    ctx.db.query("tryoutHistoryMigrations").take(2)
  );
  if (roots.length > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Content activation found multiple try-out history migration roots."
    );
  }
  const root = roots[0];
  if (!(root && ownsActiveRelease(root))) {
    return;
  }
  return yield* releaseFail(
    "CONTENT_RELEASE_STATE",
    `Content activation is locked by try-out history migration ${root.migrationId} in ${root.phase} phase.`
  );
});

import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

/** Prevents active release drift after a signed migration becomes irreversible. */
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
  if (!root || root.phase === "staging" || root.phase === "aborting") {
    return;
  }
  return yield* releaseFail(
    "CONTENT_RELEASE_STATE",
    `Content activation is locked by try-out history migration ${root.migrationId} in ${root.phase} phase.`
  );
});

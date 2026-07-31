import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { EXACT_SCOPE_LIMIT } from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

/** Detects exact material work that must finish before source fallback is safe. */
export const hasExactMaterialOwnerWork = Effect.fn(
  "contentRelease.hasExactMaterialOwnerWork"
)(function* (ctx: QueryCtx, releaseId: string) {
  const [stored, transitions] = yield* Effect.all([
    Effect.promise(() => ctx.db.query("materialOwners").first()),
    Effect.promise(() =>
      ctx.db
        .query("contentOwners")
        .withIndex("by_releaseId_and_contentKey_and_locale", (index) =>
          index.eq("releaseId", releaseId)
        )
        .take(EXACT_SCOPE_LIMIT + 1)
    ),
  ]);
  if (transitions.length > EXACT_SCOPE_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Release ${releaseId} exceeds ${EXACT_SCOPE_LIMIT} exact ownership transitions.`
    );
  }
  return (
    stored !== null ||
    transitions.some((transition) => transition.family === "material")
  );
});

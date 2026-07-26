import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import { Effect } from "effect";

type ActiveIdentity = NonNullable<
  Effect.Effect.Success<ReturnType<typeof loadActiveIdentity>>
>;

/** Returns Git provenance only when the active release owns source bytes. */
export function getSourceRevision(active: ActiveIdentity) {
  return active.signed.manifest.origin.kind === "git"
    ? active.signed.manifest.origin.sha
    : null;
}

/** Loads article ownership only after its active read model is complete. */
export const loadArticleOwner = Effect.fn("contentRelease.loadArticleOwner")(
  function* (ctx: QueryCtx, locale: Doc<"contentKeys">["locale"]) {
    const active = yield* loadActiveIdentity(ctx);
    if (!active) {
      return { active: null, managed: false };
    }
    const owned = yield* Effect.promise(() =>
      ctx.db
        .query("contentKeys")
        .withIndex(
          "by_family_and_locale_and_createdSequence_and_contentKey",
          (index) =>
            index
              .eq("family", "article")
              .eq("locale", locale)
              .lte("createdSequence", active.sequence)
        )
        .take(1)
    );
    if (owned.length === 0) {
      return { active, managed: false };
    }
    if (
      active.state.articleManifestHash !== active.manifestHash ||
      active.state.articleReleaseId !== active.releaseId ||
      active.state.articleSequence !== active.sequence
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Articles for active release ${active.releaseId} are still synchronizing.`
      );
    }
    return { active, managed: true };
  }
);

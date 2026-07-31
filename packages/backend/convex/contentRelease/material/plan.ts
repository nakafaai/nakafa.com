import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { EXACT_SCOPE_LIMIT } from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

export type MaterialOwnerRelease = Pick<
  Doc<"contentReleases">,
  "releaseId" | "resultFamilies" | "sequence"
>;

export type ExactMaterialOwner = Pick<
  Doc<"materialOwners">,
  "contentKey" | "locale"
>;

/** Returns one stable identity shared by stored and staged material owners. */
export function materialOwnerIdentity(owner: ExactMaterialOwner) {
  return `${owner.locale}\0${owner.contentKey}`;
}

/** Builds the bounded exact-owner plan that one release would activate. */
export const buildExactMaterialOwnerPlan = Effect.fn(
  "contentRelease.buildExactMaterialOwnerPlan"
)(function* (ctx: QueryCtx, release: MaterialOwnerRelease) {
  const [stored, transitions] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db.query("materialOwners").take(EXACT_SCOPE_LIMIT + 1)
    ),
    Effect.promise(() =>
      ctx.db
        .query("contentOwners")
        .withIndex("by_releaseId_and_contentKey_and_locale", (index) =>
          index.eq("releaseId", release.releaseId)
        )
        .take(EXACT_SCOPE_LIMIT + 1)
    ),
  ]);
  if (stored.length > EXACT_SCOPE_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Active material ownership exceeds ${EXACT_SCOPE_LIMIT} exact identities.`
    );
  }
  if (transitions.length > EXACT_SCOPE_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Release ${release.releaseId} exceeds ${EXACT_SCOPE_LIMIT} exact ownership transitions.`
    );
  }
  if (release.resultFamilies.includes("material")) {
    return {
      expected: new Map<
        string,
        { contentKey: string; locale: ContentLocale }
      >(),
      reconcile: stored,
      stored,
    };
  }
  const materialTransitions = transitions.filter(
    (transition) => transition.family === "material"
  );
  const expected = new Map(
    stored.map(({ contentKey, locale }) => [
      materialOwnerIdentity({ contentKey, locale }),
      { contentKey, locale },
    ])
  );
  for (const transition of materialTransitions) {
    const identity = materialOwnerIdentity(transition);
    if (transition.managed) {
      expected.set(identity, {
        contentKey: transition.contentKey,
        locale: transition.locale,
      });
      continue;
    }
    expected.delete(identity);
  }
  if (expected.size > EXACT_SCOPE_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Release ${release.releaseId} would exceed ${EXACT_SCOPE_LIMIT} exact material owners.`
    );
  }
  const reconcile = new Map(
    [...stored, ...materialTransitions].map(({ contentKey, locale }) => [
      materialOwnerIdentity({ contentKey, locale }),
      { contentKey, locale },
    ])
  );
  return { expected, reconcile: Array.from(reconcile.values()), stored };
});

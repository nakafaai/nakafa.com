import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { ContentReleaseManifest } from "@nakafa/aksara-contracts/release";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadRelease } from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import {
  deriveReleaseFamilies,
  hasExactFamilies,
  loadReleaseFamilies,
} from "@repo/backend/convex/contentRelease/scope/family";
import { EXACT_SCOPE_LIMIT } from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;
type OwnerRelease = Pick<
  Doc<"contentReleases">,
  "baseFamilies" | "releaseId" | "resultFamilies" | "sequence"
>;

/** Returns one stable key for exact ownership comparison. */
function ownerIdentity(
  owner: Pick<Doc<"contentOwners">, "contentKey" | "family" | "locale">
) {
  return `${owner.family}\0${owner.contentKey}\0${owner.locale}`;
}

/** Resolves explicit exact-content ownership at one publication sequence. */
export const loadContentOwner = Effect.fn("contentRelease.loadContentOwner")(
  function* (
    ctx: ReadCtx,
    contentKey: string,
    locale: ContentLocale,
    sequence: number
  ) {
    const rows = yield* Effect.promise(() =>
      ctx.db
        .query("contentOwners")
        .withIndex("by_contentKey_and_locale_and_sequence", (query) =>
          query
            .eq("contentKey", contentKey)
            .eq("locale", locale)
            .lte("sequence", sequence)
        )
        .order("desc")
        .take(2)
    );
    if (rows[0] && rows[1]?.sequence === rows[0].sequence) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content ${contentKey}/${locale} has duplicate ownership at sequence ${rows[0].sequence}.`
      );
    }
    return rows[0] ?? null;
  }
);

/** Loads the immutable sequence restored by one rollback-origin release. */
const loadRollbackSequence = Effect.fn(
  "contentRelease.loadRollbackOwnershipSequence"
)(function* (ctx: ReadCtx, manifest: ContentReleaseManifest) {
  if (manifest.origin.kind === "git") {
    return null;
  }
  const origin = yield* loadRelease(ctx, manifest.origin.releaseId);
  const signed = yield* decodeReleaseJson(origin.releaseJson);
  if (signed.manifest.baseReleaseId === null) {
    return null;
  }
  return (yield* loadRelease(ctx, signed.manifest.baseReleaseId)).sequence;
});

/** Derives bounded exact ownership rows from the immutable release graph. */
const expectedContentOwners = Effect.fn("contentRelease.expectedContentOwners")(
  function* (
    ctx: ReadCtx,
    release: OwnerRelease,
    manifest: ContentReleaseManifest
  ) {
    if (manifest.scope.content.length > EXACT_SCOPE_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Release ${release.releaseId} exceeds ${EXACT_SCOPE_LIMIT} exact ownership identities.`
      );
    }
    const [derivedFamilies, storedFamilies] = yield* Effect.all([
      deriveReleaseFamilies(ctx, manifest),
      loadReleaseFamilies(release),
    ]);
    if (
      !(
        hasExactFamilies(derivedFamilies.base, storedFamilies.base) &&
        hasExactFamilies(derivedFamilies.result, storedFamilies.result)
      )
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Release ${release.releaseId} changed its family ownership.`
      );
    }
    const selected = manifest.scope.content.filter(
      ({ family }) => !storedFamilies.result.includes(family)
    );
    const rollbackSequence = yield* loadRollbackSequence(ctx, manifest);
    return yield* Effect.forEach(selected, (identity) =>
      Effect.gen(function* () {
        const prior =
          rollbackSequence === null
            ? null
            : yield* loadContentOwner(
                ctx,
                identity.contentKey,
                identity.locale,
                rollbackSequence
              );
        return {
          ...identity,
          managed:
            manifest.origin.kind === "git" ? true : (prior?.managed ?? false),
          releaseId: release.releaseId,
          sequence: release.sequence,
        };
      })
    );
  }
);

/** Stages every exact ownership transition without requiring a body change. */
export const stageContentOwners = Effect.fn(
  "contentRelease.stageContentOwners"
)(function* (
  ctx: MutationCtx,
  release: OwnerRelease,
  manifest: ContentReleaseManifest
) {
  const owners = yield* expectedContentOwners(ctx, release, manifest);
  for (const owner of owners) {
    const existing = yield* Effect.promise(() =>
      ctx.db
        .query("contentOwners")
        .withIndex("by_releaseId_and_contentKey_and_locale", (query) =>
          query
            .eq("releaseId", owner.releaseId)
            .eq("contentKey", owner.contentKey)
            .eq("locale", owner.locale)
        )
        .unique()
    );
    if (existing) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Content ${owner.contentKey}/${owner.locale} repeats ownership in ${owner.releaseId}.`
      );
    }
    yield* Effect.promise(() => ctx.db.insert("contentOwners", owner));
  }
});

/** Proves an invisible release retained its complete signed ownership scope. */
export const validateContentOwners = Effect.fn(
  "contentRelease.validateContentOwners"
)(function* (
  ctx: ReadCtx,
  release: OwnerRelease,
  manifest: ContentReleaseManifest
) {
  const expected = yield* expectedContentOwners(ctx, release, manifest);
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("contentOwners")
      .withIndex("by_releaseId_and_contentKey_and_locale", (query) =>
        query.eq("releaseId", release.releaseId)
      )
      .take(EXACT_SCOPE_LIMIT + 1)
  );
  const expectedByIdentity = new Map(
    expected.map((owner) => [ownerIdentity(owner), owner])
  );
  if (stored.length !== expected.length) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${release.releaseId} lost exact ownership rows.`
    );
  }
  for (const owner of stored) {
    const expectedOwner = expectedByIdentity.get(ownerIdentity(owner));
    if (
      !expectedOwner ||
      owner.family !== expectedOwner.family ||
      owner.managed !== expectedOwner.managed ||
      owner.releaseId !== expectedOwner.releaseId ||
      owner.sequence !== expectedOwner.sequence
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Release ${release.releaseId} has conflicting exact ownership.`
      );
    }
  }
});

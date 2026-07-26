import {
  type ContentFamily,
  ContentFamilySchema,
} from "@nakafa/aksara-contracts/content";
import type { ContentReleaseManifest } from "@nakafa/aksara-contracts/release";
import type { PublicationScope } from "@nakafa/aksara-contracts/release/snapshot";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadRelease } from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

/** Returns every family once in the canonical shared-contract order. */
export function mergeManagedFamilies(
  current: readonly ContentFamily[],
  selected: readonly ContentFamily[]
) {
  return ContentFamilySchema.literals.filter(
    (family) => current.includes(family) || selected.includes(family)
  );
}

/** Compares two canonical family lists without coercion. */
export function hasExactFamilies(
  stored: readonly ContentFamily[],
  derived: readonly ContentFamily[]
) {
  return (
    stored.length === derived.length &&
    stored.every((family, index) => family === derived[index])
  );
}

/** Compares two canonical signed publication scopes field by field. */
export function hasSamePublicationScope(
  left: PublicationScope,
  right: PublicationScope
) {
  return (
    hasExactFamilies(left.families, right.families) &&
    left.snapshots.length === right.snapshots.length &&
    left.snapshots.every(
      (snapshot, index) => snapshot === right.snapshots[index]
    ) &&
    left.content.length === right.content.length &&
    left.content.every((identity, index) => {
      const compared = right.content[index];
      return (
        compared?.contentKey === identity.contentKey &&
        compared.family === identity.family &&
        compared.locale === identity.locale
      );
    })
  );
}

/** Requires one immutable release to retain canonical family ownership. */
export const loadReleaseFamilies = Effect.fn(
  "contentRelease.loadReleaseFamilies"
)(function* (
  release: Pick<
    Doc<"contentReleases">,
    "baseFamilies" | "releaseId" | "resultFamilies"
  >
) {
  if (!(release.baseFamilies && release.resultFamilies)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Release ${release.releaseId} has not completed its ownership migration.`
    );
  }
  const base = mergeManagedFamilies([], release.baseFamilies);
  const result = mergeManagedFamilies([], release.resultFamilies);
  if (
    !(
      hasExactFamilies(release.baseFamilies, base) &&
      hasExactFamilies(release.resultFamilies, result)
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${release.releaseId} has non-canonical family ownership.`
    );
  }
  return { base, result };
});

/** Derives immutable base and result families from the signed release graph. */
export const deriveReleaseFamilies = Effect.fn(
  "contentRelease.deriveReleaseFamilies"
)(function* (ctx: ReadCtx, manifest: ContentReleaseManifest) {
  const base =
    manifest.baseReleaseId === null
      ? []
      : (yield* loadReleaseFamilies(
          yield* loadRelease(ctx, manifest.baseReleaseId)
        )).result;
  if (manifest.origin.kind === "git") {
    return {
      base,
      result: mergeManagedFamilies(base, manifest.scope.families),
    };
  }
  if (manifest.baseReleaseId !== manifest.origin.releaseId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Rollback ${manifest.releaseId} does not target its signed origin.`
    );
  }
  const origin = yield* loadRelease(ctx, manifest.origin.releaseId);
  const signedOrigin = yield* decodeReleaseJson(origin.releaseJson);
  if (!hasSamePublicationScope(manifest.scope, signedOrigin.manifest.scope)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Rollback ${manifest.releaseId} changed its origin publication scope.`
    );
  }
  const originFamilies = yield* loadReleaseFamilies(origin);
  return { base, result: originFamilies.base };
});

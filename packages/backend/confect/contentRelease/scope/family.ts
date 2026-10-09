import {
  type ContentFamily,
  ContentFamilySchema,
} from "@nakafa/aksara-contracts/content";
import type { ContentReleaseManifest } from "@nakafa/aksara-contracts/release";
import type { PublicationScope } from "@nakafa/aksara-contracts/release/snapshot/scope";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadRelease } from "@repo/backend/confect/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/confect/contentRelease/parse";
import { Array as Arr, Effect } from "effect";

/** Returns every family once in the canonical shared-contract order. */
export function mergeManagedFamilies(
  current: readonly ContentFamily[],
  selected: readonly ContentFamily[]
) {
  return Arr.filter(
    ContentFamilySchema.literals,
    (family) => Arr.contains(current, family) || Arr.contains(selected, family)
  );
}

/** Compares two canonical family lists without coercion. */
export function hasExactFamilies(
  stored: readonly ContentFamily[],
  derived: readonly ContentFamily[]
) {
  return (
    stored.length === derived.length &&
    Arr.every(stored, (family, index) => family === derived[index])
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
    Arr.every(
      left.snapshots,
      (snapshot, index) => snapshot === right.snapshots[index]
    )
  );
}

/** Requires one immutable release to retain canonical family ownership. */
export const loadReleaseFamilies = Effect.fn(
  "contentRelease.loadReleaseFamilies"
)(function* (
  release: Pick<
    Docs["contentReleases"],
    "baseFamilies" | "releaseId" | "resultFamilies"
  >
) {
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
  return {
    base,
    result,
  };
});

/** Derives immutable base and result families from the signed release graph. */
export const deriveReleaseFamilies = Effect.fn(
  "contentRelease.deriveReleaseFamilies"
)(function* (manifest: ContentReleaseManifest) {
  const base =
    manifest.baseReleaseId === null
      ? []
      : (yield* loadReleaseFamilies(yield* loadRelease(manifest.baseReleaseId)))
          .result;
  if (manifest.origin.kind === "git") {
    return {
      base,
      result: mergeManagedFamilies(base, manifest.scope.families),
    };
  }
  const origin = yield* loadRelease(manifest.origin.releaseId);
  const signedOrigin = yield* decodeReleaseJson(origin.releaseJson);
  if (!hasSamePublicationScope(manifest.scope, signedOrigin.manifest.scope)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Rollback ${manifest.releaseId} changed its origin publication scope.`
    );
  }
  const originFamilies = yield* loadReleaseFamilies(origin);
  return {
    base,
    result: originFamilies.base,
  };
});

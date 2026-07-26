import {
  type ContentFamily,
  type ContentPublicationIdentity,
  headIdentity,
} from "@nakafa/aksara-contracts/content";
import type { ContentReleaseManifest } from "@nakafa/aksara-contracts/release";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import {
  hasSamePublicationScope,
  mergeManagedFamilies,
} from "@repo/backend/convex/contentRelease/scope/family";
import { Effect } from "effect";

interface OwnershipSnapshot {
  readonly content: Map<string, ContentPublicationIdentity>;
  readonly families: ContentFamily[];
}

export interface ReleaseOwnership {
  readonly base: OwnershipSnapshot;
  readonly result: OwnershipSnapshot;
}

export interface OwnerVersion {
  readonly contentKey: string;
  readonly family: ContentFamily;
  readonly locale: ContentPublicationIdentity["locale"];
  readonly managed: boolean;
  readonly releaseId: string;
  readonly sequence: number;
}

/** Copies one ownership snapshot before applying a release transition. */
function copySnapshot(snapshot: OwnershipSnapshot): OwnershipSnapshot {
  return {
    content: new Map(snapshot.content),
    families: [...snapshot.families],
  };
}

/** Applies one reviewed Git scope to its immutable base ownership. */
function applyGitScope(
  base: OwnershipSnapshot,
  content: readonly ContentPublicationIdentity[],
  families: readonly ContentFamily[]
) {
  const result = {
    content: new Map(base.content),
    families: mergeManagedFamilies(base.families, families),
  };
  for (const identity of content) {
    result.content.set(headIdentity(identity), identity);
  }
  return result;
}

/** Reconstructs family state and exact owner versions from release history. */
export const deriveOwnership = Effect.fn("contentRelease.deriveOwnership")(
  function* (releases: readonly Doc<"contentReleases">[]) {
    const history = new Map<string, ReleaseOwnership>();
    const manifests = new Map<string, ContentReleaseManifest>();
    const owners: OwnerVersion[] = [];
    let previousSequence = 0;
    for (const release of releases) {
      if (
        release.sequence <= previousSequence ||
        history.has(release.releaseId)
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Ownership migration found unordered release identities."
        );
      }
      const signed = yield* decodeReleaseJson(release.releaseJson);
      let base: OwnershipSnapshot = { content: new Map(), families: [] };
      if (signed.manifest.baseReleaseId !== null) {
        const baseOwnership = history.get(signed.manifest.baseReleaseId);
        if (!baseOwnership) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            `Release ${release.releaseId} lost its ownership base.`
          );
        }
        base = baseOwnership.result;
      }
      let result: OwnershipSnapshot;
      if (signed.manifest.origin.kind === "git") {
        result = applyGitScope(
          base,
          signed.manifest.scope.content,
          signed.manifest.scope.families
        );
      } else {
        const forward = history.get(signed.manifest.origin.releaseId);
        const forwardManifest = manifests.get(signed.manifest.origin.releaseId);
        if (
          !(forward && forwardManifest) ||
          signed.manifest.baseReleaseId !== signed.manifest.origin.releaseId
        ) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            `Recovery ${release.releaseId} lost its forward ownership state.`
          );
        }
        if (
          !hasSamePublicationScope(signed.manifest.scope, forwardManifest.scope)
        ) {
          return yield* releaseFail(
            "CONTENT_RELEASE_CONFLICT",
            `Recovery ${release.releaseId} changed its origin publication scope.`
          );
        }
        result = copySnapshot(forward.base);
      }
      history.set(release.releaseId, { base, result });
      manifests.set(release.releaseId, signed.manifest);
      if (release.status !== "aborted") {
        for (const identity of signed.manifest.scope.content) {
          if (!result.families.includes(identity.family)) {
            owners.push({
              ...identity,
              managed: result.content.has(headIdentity(identity)),
              releaseId: release.releaseId,
              sequence: release.sequence,
            });
          }
        }
      }
      previousSequence = release.sequence;
    }
    return { history, owners };
  }
);

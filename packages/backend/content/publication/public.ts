import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import { ArtifactLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  canonicalizeContentProjection,
  familyForProjection,
} from "@nakafa/aksara-contracts/projection/spec";
import { hashText } from "@repo/backend/confect/contentRelease/digest";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  decodeArtifactJson,
  decodeProjectionJson,
} from "@repo/backend/confect/contentRelease/parse";
import type { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { PUBLIC_CONTENT_RUNTIME_BATCH_SIZE } from "@repo/backend/content/batch";
import { loadActiveIdentity } from "@repo/backend/content/publication/read";
import { resolveActiveRoute } from "@repo/backend/content/publication/route";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { PublicationSource } from "@repo/backend/content/publication/source";
import type { publicRequestValidator } from "@repo/backend/content/publication/spec";
import { Array as Arr, Effect, Option } from "effect";

type AppLocale = typeof appLocaleValidator.Type;
type ActiveIdentity = NonNullable<
  Effect.Success<ReturnType<typeof loadActiveIdentity>>
>;
/** Stored active public row returned only to the authenticated HTTP adapter. */

/** Requires complete runtime provenance and authenticates the selected artifact. */
const readPublicArtifact = Effect.fn("contentRelease.readPublicArtifact")(
  function* (head: PublicationRow<"contentHeads">) {
    const source = yield* PublicationSource;
    if (
      !(
        head.artifactHash &&
        head.compilerConfigHash &&
        head.projectionHash &&
        head.projectionJson &&
        head.rendererDomain &&
        head.sourceHash &&
        head.sourcePath
      )
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Published route ${head.contentKey}/${head.artifactLocale} lost runtime fields.`
      );
    }
    const artifactHash = head.artifactHash;
    const artifact = Option.getOrNull(yield* source.artifact(artifactHash));
    if (!artifact) {
      return yield* releaseFail(
        "CONTENT_RELEASE_MISSING",
        `Published route ${head.contentKey}/${head.artifactLocale} lost its artifact.`
      );
    }
    const decodedArtifact = yield* decodeArtifactJson(artifact.artifactJson);
    if (
      decodedArtifact.artifactHash !== head.artifactHash ||
      decodedArtifact.payload.contentKey !== head.contentKey ||
      decodedArtifact.payload.compilerConfigHash !== head.compilerConfigHash ||
      decodedArtifact.payload.artifactLocale !== head.artifactLocale ||
      decodedArtifact.payload.rendererDomain !== head.rendererDomain ||
      decodedArtifact.payload.sourceHash !== head.sourceHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Published content ${head.contentKey}/${head.artifactLocale} has mismatched artifact provenance.`
      );
    }
    return { artifactJson: artifact.artifactJson };
  }
);

/**
 * The release-independent parts of an already selected public body, read without
 * its artifact: the artifact's hash, the projection's hash and the source path. A
 * reader takes the release's signed document once and the artifact by its hash,
 * which never changes, so a later release reads only the artifacts it changed.
 */
export const readSelectedPublicHead = Effect.fn(
  "contentRelease.readSelectedPublicHead"
)(function* (
  route: Pick<
    Effect.Success<ReturnType<typeof resolveActiveRoute>>,
    "active" | "projection"
  >
) {
  if (!(route.active && route.projection)) {
    return null;
  }
  const { head, projectionHash, sourcePath } = route.projection;
  if (!head.artifactHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Published route ${head.contentKey}/${head.artifactLocale} lost its artifact hash.`
    );
  }
  return { artifactHash: head.artifactHash, projectionHash, sourcePath };
});

/**
 * Reads the signed artifact of one routed public body by its hash, only while the
 * route's active head names that hash, so a hash alone never opens a body that
 * the active release does not publish at that route.
 */
export const readRoutedPublicArtifact = Effect.fn(
  "contentRelease.readRoutedPublicArtifact"
)(function* (
  family: ContentFamily,
  appLocale: AppLocale,
  publicPath: string,
  artifactHash: string
) {
  const route = yield* resolveActiveRoute(family, appLocale, publicPath);
  if (
    !(route.managed && route.projection) ||
    route.projection.head.artifactHash !== artifactHash
  ) {
    return null;
  }
  const { artifactJson } = yield* readPublicArtifact(route.projection.head);
  return { artifactJson };
});

/**
 * Selects an active route's head and authenticates its projection, without reading
 * its artifact: a reader takes the artifact by the hash the head names. Answers
 * null for a route that is unbound, withdrawn, or not publicly delivered.
 */
const selectPublicRouteHead = Effect.fn("contentRelease.selectPublicRouteHead")(
  function* (active: ActiveIdentity, appLocale: AppLocale, publicPath: string) {
    const source = yield* PublicationSource;
    const binding = Option.getOrNull(
      yield* source.binding(appLocale, publicPath, active.sequence)
    );
    if (!binding || binding.operation === "delete") {
      return null;
    }
    if (!binding.contentKey) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Published route ${appLocale}/${publicPath} lost its content identity.`
      );
    }
    const head = Option.getOrNull(
      yield* source.version(
        binding.contentKey,
        ArtifactLocaleSchema.make(appLocale),
        active.sequence
      )
    );
    if (head?.operation !== "upsert") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Published route ${appLocale}/${publicPath} lost its active head.`
      );
    }
    if (
      head.sequence === binding.sequence &&
      head.releaseId !== binding.releaseId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Published route ${appLocale}/${publicPath} disagrees at one sequence.`
      );
    }
    if (head.delivery !== "public") {
      return null;
    }
    if (!(head.artifactHash && head.projectionJson && head.sourcePath)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Published route ${appLocale}/${publicPath} lost runtime fields.`
      );
    }
    const projection = yield* decodeProjectionJson(head.projectionJson);
    const projectionHash = yield* hashText(
      canonicalizeContentProjection(projection)
    );
    if (
      familyForProjection(projection) !== head.family ||
      projectionHash !== head.projectionHash ||
      projection.contentKey !== head.contentKey ||
      projection.appLocale !== appLocale ||
      projection.publicPath !== publicPath
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Published route ${appLocale}/${publicPath} has mismatched content.`
      );
    }
    return {
      artifactHash: head.artifactHash,
      head,
      projectionHash,
      projectionJson: head.projectionJson,
      sourcePath: head.sourcePath,
    };
  }
);

/** Resolves an active route and enforces its public delivery class. */
const resolvePublicRouteForActive = Effect.fn(
  "contentRelease.resolvePublicRouteForActive"
)(function* (active: ActiveIdentity, appLocale: AppLocale, publicPath: string) {
  const selected = yield* selectPublicRouteHead(active, appLocale, publicPath);
  if (!selected) {
    return null;
  }
  const { artifactJson } = yield* readPublicArtifact(selected.head);
  return {
    activeManifestHash: active.manifestHash,
    activeReleaseId: active.releaseId,
    artifactJson,
    delivery: selected.head.delivery,
    projectionHash: selected.projectionHash,
    projectionJson: selected.projectionJson,
    releaseJson: active.release.releaseJson,
    rendererJson: active.release.rendererJson,
    sourcePath: selected.sourcePath,
  };
});

/**
 * The head of one active public route, read without its artifact: the release it
 * belongs to, its family, the artifact's hash, and its authenticated projection,
 * projection hash and source path. A reader takes the release's signed frame once
 * and the artifact by its hash, so a later release reads only the bodies it changed.
 */
export const readPublicRouteHead = Effect.fn(
  "contentRelease.readPublicRouteHead"
)(function* (appLocale: AppLocale, publicPath: string) {
  const active = yield* loadActiveIdentity();
  if (!active) {
    return null;
  }
  const selected = yield* selectPublicRouteHead(active, appLocale, publicPath);
  if (!selected) {
    return null;
  }
  return {
    activeReleaseId: active.releaseId,
    artifactHash: selected.artifactHash,
    family: selected.head.family,
    projectionHash: selected.projectionHash,
    projectionJson: selected.projectionJson,
    sourcePath: selected.sourcePath,
  };
});
/** Resolves one active public route for the singular runtime endpoint. */
export const resolvePublicRoute = Effect.fn(
  "contentRelease.resolvePublicRoute"
)(function* (appLocale: AppLocale, publicPath: string) {
  const active = yield* loadActiveIdentity();
  if (!active) {
    return null;
  }
  return yield* resolvePublicRouteForActive(active, appLocale, publicPath);
});
/** Resolves one bounded public batch inside one consistent transaction. */
export const resolvePublicRoutes = Effect.fn(
  "contentRelease.resolvePublicRoutes"
)(function* (requests: readonly (typeof publicRequestValidator.Type)[]) {
  if (
    requests.length === 0 ||
    requests.length > PUBLIC_CONTENT_RUNTIME_BATCH_SIZE
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Public runtime batch exceeded its transaction bound."
    );
  }
  const active = yield* loadActiveIdentity();
  if (!active) {
    return Arr.map(requests, () => null);
  }
  return yield* Effect.forEach(requests, (request) =>
    resolvePublicRouteForActive(active, request.appLocale, request.publicPath)
  );
});

import { CorpusSourcePathSchema } from "@nakafa/aksara-contracts/ids";
import { ArtifactLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  canonicalizeContentProjection,
  familyForProjection,
} from "@nakafa/aksara-contracts/projection/spec";
import type { PublicContentRuntimeFound } from "@nakafa/aksara-contracts/runtime/spec";
import { PUBLIC_CONTENT_RUNTIME_BATCH_SIZE } from "@repo/backend/content/batch";
import { loadActiveIdentity } from "@repo/backend/content/publication/read";
import type { resolveActiveRoute } from "@repo/backend/content/publication/route";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { PublicationSource } from "@repo/backend/content/publication/source";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import {
  decodeArtifactJson,
  decodeProjectionJson,
} from "@repo/backend/convex/contentRelease/parse";
import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect, Option, Schema } from "effect";

export const publicResultValidator = v.union(
  v.null(),
  v.object({
    activeManifestHash: v.string(),
    activeReleaseId: v.string(),
    artifactJson: v.string(),
    delivery: v.literal("public"),
    projectionHash: v.string(),
    projectionJson: v.string(),
    releaseJson: v.string(),
    rendererJson: v.string(),
    sourcePath: v.string(),
  })
);
export const publicRequestValidator = v.object({
  appLocale: appLocaleValidator,
  publicPath: v.string(),
});
export const publicBatchResultValidator = v.array(publicResultValidator);
type AppLocale = Infer<typeof appLocaleValidator>;
type ActiveIdentity = NonNullable<
  Effect.Success<ReturnType<typeof loadActiveIdentity>>
>;
/** Stored active public row returned only to the authenticated HTTP adapter. */
export type PublicRuntimeRow = Infer<typeof publicResultValidator>;
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
    return {
      artifactJson: artifact.artifactJson,
      decodedArtifact,
      projectionJson: head.projectionJson,
      sourcePath: head.sourcePath,
    };
  }
);

/** Delivers an already selected publication without reopening its source graph. */
export const readSelectedPublicRuntime = Effect.fn(
  "contentRelease.readSelectedPublicRuntime"
)(function* (
  route: Pick<
    Effect.Success<ReturnType<typeof resolveActiveRoute>>,
    "active" | "projection"
  >
) {
  if (!(route.active && route.projection)) {
    return null;
  }
  const { active, projection: selected } = route;
  const { decodedArtifact: artifact } = yield* readPublicArtifact(
    selected.head
  );
  const sourcePath = yield* Schema.decodeEffect(CorpusSourcePathSchema)(
    selected.sourcePath
  ).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "The selected public source path is invalid.",
        })
    )
  );
  if (
    active.releaseId !== active.signed.manifest.releaseId ||
    active.manifestHash !== active.signed.manifestHash
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "The selected public release identity is invalid."
    );
  }
  const response: PublicContentRuntimeFound = {
    activeManifestHash: active.signed.manifestHash,
    activeReleaseId: active.signed.manifest.releaseId,
    artifact,
    delivery: "public",
    kind: "found",
    projection: selected.projection,
    projectionHash: selected.projectionHash,
    release: active.signed,
    rendererManifest: active.renderer,
    sourcePath,
  };
  return { projectionJson: selected.projectionJson, response };
});

/** Resolves an active route and enforces its public delivery class. */
const resolvePublicRouteForActive = Effect.fn(
  "contentRelease.resolvePublicRouteForActive"
)(function* (active: ActiveIdentity, appLocale: AppLocale, publicPath: string) {
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
  const { artifactJson, projectionJson, sourcePath } =
    yield* readPublicArtifact(head);
  const projection = yield* decodeProjectionJson(projectionJson);
  const projectionHash = yield* hashText(
    "the published content projection",
    canonicalizeContentProjection(projection)
  );
  if (
    familyForProjection(projection) !== head.family ||
    projection.kind === "question-body" ||
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
    activeManifestHash: active.manifestHash,
    activeReleaseId: active.releaseId,
    artifactJson,
    delivery: head.delivery,
    projectionHash,
    projectionJson,
    releaseJson: active.release.releaseJson,
    rendererJson: active.release.rendererJson,
    sourcePath,
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
)(function* (
  requests: readonly {
    readonly appLocale: AppLocale;
    readonly publicPath: string;
  }[]
) {
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
    return requests.map(() => null);
  }
  return yield* Effect.forEach(requests, (request) =>
    resolvePublicRouteForActive(active, request.appLocale, request.publicPath)
  );
});

import "@tanstack/react-start/server-only";

import type { Ref } from "@confect/core";
import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { ContentProjectionSchema } from "@nakafa/aksara-contracts/projection/spec";
import {
  type PublicContentRuntimeFound,
  PublicContentRuntimeFoundSchema,
} from "@nakafa/aksara-contracts/runtime/spec";

import {
  readPublicContent,
  verifyPublicContentFound,
} from "@repo/backend/client/content/public";
import type contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { contentRuntimeKeys } from "@repo/site/keys";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import { Effect, Schema } from "effect";
import { env } from "@/env";
import {
  ContentRuntimeConfigurationError,
  PublishedProjectionError,
  PublishedReleaseMismatchError,
} from "@/lib/content/published/errors";
import {
  readPublicArtifact,
  readReleaseFrame,
} from "@/lib/content/published/parts";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import { readContentStore } from "@/lib/content/store/read";

const PublishedContentRouteInputSchema = Schema.Struct({
  appLocale: AppLocaleSchema,
  publicPath: Schema.String,
});
/** Exact public identity sent to the server-only content runtime seam. */
export type PublishedContentRouteInput =
  typeof PublishedContentRouteInputSchema.Type;

const PublishedContentInputSchema = Schema.Struct({
  ...PublishedContentRouteInputSchema.fields,
  activeReleaseId: ReleaseIdSchema,
});
/** Public identity pinned to one release selected by another trusted read. */
export type PublishedContentInput = typeof PublishedContentInputSchema.Type;

/** Verified family-neutral data safe to return from a cached function. */
const PublishedContentDataSchema = Schema.Struct({
  activeReleaseId: PublicContentRuntimeFoundSchema.fields.activeReleaseId,
  artifact: PublicContentRuntimeFoundSchema.fields.artifact,
  projection: ContentProjectionSchema,
  rendererManifest: PublicContentRuntimeFoundSchema.fields.rendererManifest,
  sourcePath: PublicContentRuntimeFoundSchema.fields.sourcePath,
  sourceRevision: Schema.NullOr(GitCommitShaSchema),
});
export type PublishedContentData = typeof PublishedContentDataSchema.Type;

/** Returns exact Git provenance only for normal source-backed releases. */
function readSourceRevision(found: PublicContentRuntimeFound) {
  const { origin } = found.release.manifest;
  return origin.kind === "git" ? origin.sha : null;
}

/** The head of one routed public body, as a lesson's or an article's query names it. */
type PublicHead = NonNullable<
  Ref.Returns<typeof contentRelease.material.lesson>["delivery"]
>;

/** Reads one JSON text that a signed part arrived as, or the route's projection failure. */
const decodePart = (input: PublishedContentRouteInput, text: string) =>
  Schema.decodeEffect(JsonTextSchema)(text).pipe(
    Effect.mapError(() => new PublishedProjectionError(input))
  );

/**
 * Composes and verifies the signed public response of one routed body from its
 * parts: the release's signed document and renderer manifest, read once per
 * release; the artifact, read by the hash the head names and kept across
 * releases; and the projection, projection hash and source path of the head. Each
 * part keeps its own signature, so the response proves what one query's envelope
 * did, and a release that keeps a body reads none of it again. The artifact must
 * be the one the head names, because neither its signature nor the response
 * contract binds it to a route: route membership is Convex's authority.
 */
export const decodePublishedDelivery = Effect.fn(
  "NakafaContent.decodePublishedDelivery"
)(function* (
  input: PublishedContentInput & Record<"family", ContentFamily>,
  head: PublicHead,
  projectionJson: string
) {
  const route = { appLocale: input.appLocale, publicPath: input.publicPath };
  const [liveRenderer, frame, artifactJson] = yield* Effect.all(
    [
      rendererManifest,
      readReleaseFrame(input.activeReleaseId),
      readPublicArtifact({
        appLocale: input.appLocale,
        artifactHash: head.artifactHash,
        family: input.family,
        publicPath: input.publicPath,
      }),
    ],
    { concurrency: "unbounded" }
  );
  if (frame === null || artifactJson === null) {
    return yield* new PublishedProjectionError(route);
  }
  const [artifact, projection, release, renderer] = yield* Effect.all([
    decodePart(route, artifactJson),
    decodePart(route, projectionJson),
    decodePart(route, frame.releaseJson),
    decodePart(route, frame.rendererJson),
  ]);
  const found = yield* verifyPublicContentFound(
    route,
    {
      activeManifestHash: frame.activeManifestHash,
      activeReleaseId: frame.activeReleaseId,
      artifact,
      delivery: "public",
      kind: "found",
      projection,
      projectionHash: head.projectionHash,
      release,
      rendererManifest: renderer,
      sourcePath: head.sourcePath,
    },
    liveRenderer
  );
  if (found.artifact.artifactHash !== head.artifactHash) {
    return yield* new PublishedProjectionError(route);
  }
  return {
    activeReleaseId: found.activeReleaseId,
    artifact: found.artifact,
    projection: found.projection,
    rendererManifest: found.rendererManifest,
    sourcePath: found.sourcePath,
    sourceRevision: readSourceRevision(found),
  } satisfies PublishedContentData;
});

/** Verifies active membership and every signed runtime value for one route. */
export const readCurrentPublishedContent = Effect.fn(
  "NakafaContent.readCurrentPublishedContent"
)(function* (input: PublishedContentRouteInput) {
  const request = {
    appLocale: input.appLocale,
    publicPath: input.publicPath,
  };
  const liveRenderer = yield* rendererManifest;
  const runtimeKeys = yield* Effect.try({
    try: contentRuntimeKeys,
    catch: () =>
      new ContentRuntimeConfigurationError({
        key: "CONTENT_READ_TOKEN",
      }),
  });
  const found = yield* readContentStore({
    kind: "content.public",
    load: readPublicContent(
      {
        siteUrl: env.VITE_CONVEX_SITE_URL,
        token: runtimeKeys.CONTENT_READ_TOKEN,
      },
      request,
      liveRenderer
    ),
    parts: [input.appLocale, input.publicPath, encodeJsonText(liveRenderer)],
    schema: PublicContentRuntimeFoundSchema,
  });
  const data: PublishedContentData = {
    activeReleaseId: found.activeReleaseId,
    artifact: found.artifact,
    projection: found.projection,
    rendererManifest: found.rendererManifest,
    sourcePath: found.sourcePath,
    sourceRevision: readSourceRevision(found),
  };
  return data;
});

/** Verifies one public runtime exchange against an already-selected release. */
export const readPublishedContent = Effect.fn(
  "NakafaContent.readPublishedContent"
)(function* (input: PublishedContentInput) {
  const found = yield* readCurrentPublishedContent(input);
  if (found.activeReleaseId !== input.activeReleaseId) {
    return yield* new PublishedReleaseMismatchError({
      actualReleaseId: found.activeReleaseId,
      expectedReleaseId: input.activeReleaseId,
    });
  }
  return found;
});

import "server-only";

import type { GitCommitSha } from "@nakafa/aksara-contracts/ids";
import type { AppLocale } from "@nakafa/aksara-contracts/locale";
import type { ContentProjection } from "@nakafa/aksara-contracts/projection/spec";
import type { PublicContentRuntimeFound } from "@nakafa/aksara-contracts/runtime/spec";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import {
  readPublicContent,
  readSnapshotPublicContent,
} from "@repo/backend/client/content/public";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { Effect } from "effect";
import { env } from "@/env";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import {
  ContentRuntimeConfigurationError,
  PublishedReleaseMismatchError,
} from "@/lib/content/published/errors";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import { loadContentSnapshot } from "@/lib/content/runtime/snapshot";

/** Exact public identity sent to the server-only content runtime seam. */
export interface PublishedContentRouteInput {
  readonly appLocale: AppLocale;
  readonly publicPath: string;
}

/** Public identity pinned to one release selected by another trusted read. */
export interface PublishedContentInput extends PublishedContentRouteInput {
  readonly activeReleaseId: ActiveContentReleaseId;
}

/** Verified family-neutral data safe to return from a Next Cache Component. */
export interface PublishedContentData {
  readonly activeReleaseId: PublicContentRuntimeFound["activeReleaseId"];
  readonly artifact: PublicContentRuntimeFound["artifact"];
  readonly projection: ContentProjection;
  readonly rendererManifest: PublicContentRuntimeFound["rendererManifest"];
  readonly sourcePath: PublicContentRuntimeFound["sourcePath"];
  readonly sourceRevision: GitCommitSha | null;
}

/** Returns exact Git provenance only for normal source-backed releases. */
function readSourceRevision(found: PublicContentRuntimeFound) {
  const { origin } = found.release.manifest;
  return origin.kind === "git" ? origin.sha : null;
}

/** Verifies active membership and every signed runtime value for one route. */
export const readCurrentPublishedContent = Effect.fn(
  "NakafaContent.readCurrentPublishedContent"
)(function* (input: PublishedContentRouteInput) {
  const request = {
    appLocale: input.appLocale,
    publicPath: input.publicPath,
  };
  const liveRenderer = yield* rendererManifest;
  const snapshot = yield* Effect.tryPromise({
    try: loadContentSnapshot,
    catch: (cause) => new ContentRuntimeVerificationError({ cause }),
  });
  let found: PublicContentRuntimeFound;
  if (snapshot === undefined) {
    const runtimeKeys = yield* Effect.try({
      try: contentRuntimeKeys,
      catch: () =>
        new ContentRuntimeConfigurationError({
          key: "CONTENT_RUNTIME_TOKEN",
        }),
    });
    found = yield* readPublicContent(
      {
        siteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
        token: runtimeKeys.CONTENT_RUNTIME_TOKEN,
      },
      request,
      liveRenderer
    );
  } else {
    found = yield* readSnapshotPublicContent(request, liveRenderer).pipe(
      Effect.provideContext(snapshot)
    );
  }
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

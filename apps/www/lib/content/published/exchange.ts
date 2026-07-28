import "server-only";

import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { GitCommitSha } from "@nakafa/aksara-contracts/ids";
import type { ContentProjection } from "@nakafa/aksara-contracts/projection/spec";
import type { ContentRuntimeFound } from "@nakafa/aksara-contracts/runtime/spec";
import { readPublicContent } from "@repo/backend/client/content/read";
import { verifyContentRenderer } from "@repo/backend/content/verify";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { Effect } from "effect";
import { env } from "@/env";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import {
  ContentRuntimeConfigurationError,
  PublishedReleaseMismatchError,
} from "@/lib/content/published/errors";
import { rendererManifest } from "@/lib/content/renderer/manifest";

/** Exact public identity sent to the server-only content runtime seam. */
export interface PublishedContentInput {
  readonly activeReleaseId: ActiveContentReleaseId;
  readonly locale: ContentLocale;
  readonly publicPath: string;
}

/** Verified family-neutral data safe to return from a Next Cache Component. */
export interface PublishedContentData {
  readonly activeReleaseId: ContentRuntimeFound["activeReleaseId"];
  readonly artifact: ContentRuntimeFound["artifact"];
  readonly projection: ContentProjection;
  readonly rendererManifest: ContentRuntimeFound["rendererManifest"];
  readonly sourcePath: ContentRuntimeFound["sourcePath"];
  readonly sourceRevision: GitCommitSha | null;
}

/** Returns exact Git provenance only for normal source-backed releases. */
function readSourceRevision(found: ContentRuntimeFound) {
  const { origin } = found.release.manifest;
  return origin.kind === "git" ? origin.sha : null;
}

/** Verifies active membership and every signed runtime value for one route. */
export const readPublishedContent = Effect.fn(
  "NakafaContent.readPublishedContent"
)(function* (input: PublishedContentInput) {
  const runtimeKeys = yield* Effect.try({
    try: contentRuntimeKeys,
    catch: () =>
      new ContentRuntimeConfigurationError({
        key: "CONTENT_RUNTIME_TOKEN",
      }),
  });
  const found = yield* readPublicContent(
    {
      siteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
      token: runtimeKeys.CONTENT_RUNTIME_TOKEN,
    },
    { locale: input.locale, publicPath: input.publicPath }
  );
  if (found.activeReleaseId !== input.activeReleaseId) {
    return yield* new PublishedReleaseMismatchError({
      actualReleaseId: found.activeReleaseId,
      expectedReleaseId: input.activeReleaseId,
    });
  }
  const liveRenderer = yield* rendererManifest;
  yield* verifyContentRenderer({
    found,
    rendererManifest: liveRenderer,
  });

  return {
    activeReleaseId: found.activeReleaseId,
    artifact: found.artifact,
    projection: found.projection,
    rendererManifest: found.rendererManifest,
    sourcePath: found.sourcePath,
    sourceRevision: readSourceRevision(found),
  } satisfies PublishedContentData;
});

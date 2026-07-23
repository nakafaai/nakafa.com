import "server-only";

import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { GitCommitSha } from "@nakafa/aksara-contracts/ids";
import type { MaterialMetadata } from "@nakafa/aksara-contracts/projection/material";
import type { ContentRuntimeFound } from "@nakafa/aksara-contracts/runtime/spec";
import { verifyContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/verify";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import type { PublicContentRouteSchema } from "@repo/contents/_types/route/schema";
import { Effect } from "effect";
import {
  PublishedContentFailureError,
  PublishedContentMissingError,
} from "@/lib/content/published/errors";
import { decodePublishedRoute } from "@/lib/content/published/projection";
import { fetchPublicContentRuntime } from "@/lib/content/published/request";
import { contentKeyResolver } from "@/lib/content/published/trust";
import { rendererManifest } from "@/lib/content/renderer/manifest";

/** Exact public material identity sent to the server-only runtime seam. */
export interface PublishedMaterialInput {
  readonly locale: ContentLocale;
  readonly publicPath: string;
}

/** Verified plain data safe to return from a Next Cache Component. */
export interface PublishedMaterialData {
  readonly activeReleaseId: ContentRuntimeFound["activeReleaseId"];
  readonly artifact: ContentRuntimeFound["artifact"];
  readonly metadata: MaterialMetadata;
  readonly rendererManifest: ContentRuntimeFound["rendererManifest"];
  readonly route: typeof PublicContentRouteSchema.Type;
  readonly sourcePath: ContentRuntimeFound["sourcePath"];
  readonly sourceRevision: GitCommitSha | null;
}

/** Returns exact Git provenance only for normal source-backed releases. */
function readSourceRevision(found: ContentRuntimeFound) {
  const { origin } = found.release.manifest;
  return origin.kind === "git" ? origin.sha : null;
}

/** Verifies active membership and every signed runtime value for one route. */
export const readPublishedMaterial = Effect.fn(
  "NakafaContent.readPublishedMaterial"
)(function* (input: PublishedMaterialInput) {
  const exchange = yield* fetchPublicContentRuntime({
    delivery: "public",
    locale: input.locale,
    publicPath: input.publicPath,
  });
  const liveRenderer = yield* rendererManifest;
  const verified = yield* verifyContentRuntimeExchange({
    rendererManifest: liveRenderer,
    request: exchange.request,
    response: exchange.response,
  }).pipe(
    Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver)
  );

  if (verified.kind === "missing") {
    return yield* new PublishedContentMissingError(input);
  }
  if (verified.kind === "failure") {
    return yield* new PublishedContentFailureError({
      code: verified.code,
      status: exchange.status,
    });
  }
  const route = yield* decodePublishedRoute(verified.projection, input);

  return {
    activeReleaseId: verified.activeReleaseId,
    artifact: verified.artifact,
    metadata: verified.projection.metadata,
    rendererManifest: verified.rendererManifest,
    route,
    sourcePath: verified.sourcePath,
    sourceRevision: readSourceRevision(verified),
  } satisfies PublishedMaterialData;
});

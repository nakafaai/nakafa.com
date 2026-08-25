import "server-only";

import type { PublicPageProjection } from "@nakafa/aksara-contracts/projection/page";
import { Effect, Option } from "effect";
import type { ReactNode } from "react";
import {
  applyPublishedCatalogCache,
  applyPublishedContentCache,
} from "@/lib/content/cache";
import { evaluateVerifiedArtifact } from "@/lib/content/published/artifact";
import {
  type PublishedContentData,
  type PublishedContentInput,
  type PublishedContentRouteInput,
  readCurrentPublishedContent,
  readPublishedContent,
} from "@/lib/content/published/exchange";
import { decodePublishedPage } from "@/lib/content/published/projection";

/** Public Page identity pinned to one selected release. */
export type PublishedPageInput = PublishedContentInput;

/** Current public Page identity resolved from signed runtime state. */
export type CurrentPublishedPageInput = PublishedContentRouteInput;

/** Verified signed runtime data narrowed to the Page projection contract. */
export interface PublishedPageData
  extends Omit<PublishedContentData, "projection"> {
  readonly projection: PublicPageProjection;
}

/** Reviewed Page body and its immutable publication evidence. */
export interface PublishedPageContent {
  readonly artifactHash: PublishedPageData["artifact"]["artifactHash"];
  readonly body: ReactNode;
  readonly projection: PublicPageProjection;
  readonly rawMdx: string;
  readonly sourcePath: PublishedPageData["sourcePath"];
  readonly sourceRevision: PublishedPageData["sourceRevision"];
}

/** Narrows one authenticated runtime exchange to a signed Page. */
const decodePageData = Effect.fn("NakafaContent.decodePageData")(function* (
  data: PublishedContentData,
  input: CurrentPublishedPageInput
) {
  const projection = yield* decodePublishedPage(data.projection, input);
  return {
    activeReleaseId: data.activeReleaseId,
    artifact: data.artifact,
    projection,
    rendererManifest: data.rendererManifest,
    sourcePath: data.sourcePath,
    sourceRevision: data.sourceRevision,
  } satisfies PublishedPageData;
});

/** Reads a Page pinned to a release selected by another trusted read. */
export const readPublishedPage = Effect.fn("NakafaContent.readPublishedPage")(
  function* (input: PublishedPageInput) {
    const data = yield* readPublishedContent(input);
    return yield* decodePageData(data, input);
  }
);

/** Reads a Page directly from the signed current runtime. */
export const readCurrentPublishedPage = Effect.fn(
  "NakafaContent.readCurrentPublishedPage"
)(function* (input: CurrentPublishedPageInput) {
  const data = yield* readCurrentPublishedContent(input);
  return yield* decodePageData(data, input);
});

/** Evaluates one Page artifact already authenticated by its runtime exchange. */
const renderPageArtifact = Effect.fn("NakafaContent.renderPageArtifact")(
  function* (data: PublishedPageData) {
    const rendered = yield* evaluateVerifiedArtifact({
      artifact: data.artifact,
    });
    return {
      artifactHash: data.artifact.artifactHash,
      body: <rendered.Content />,
      projection: data.projection,
      rawMdx: rendered.artifact.payload.rawMdx,
      sourcePath: data.sourcePath,
      sourceRevision: data.sourceRevision,
    } satisfies PublishedPageContent;
  }
);

/** Caches one current Page while preserving a truthful signed absence. */
export async function getCurrentPublishedPage(
  input: CurrentPublishedPageInput
) {
  "use cache";

  const result = await Effect.runPromise(
    readCurrentPublishedPage(input).pipe(
      Effect.map(Option.some),
      Effect.catchTag("ContentRuntimeMissingError", () =>
        Effect.succeed(Option.none<PublishedPageData>())
      )
    )
  );
  if (Option.isNone(result)) {
    applyPublishedCatalogCache("page");
    return null;
  }
  applyPublishedContentCache("page", result.value.artifact.artifactHash);
  return result.value;
}

/** Caches current Page JSX resolved without a second runtime lookup. */
export async function renderCurrentPublishedPage(
  input: CurrentPublishedPageInput
) {
  "use cache";

  const data = await getCurrentPublishedPage(input);
  if (!data) {
    applyPublishedCatalogCache("page");
    return null;
  }
  const rendered = await Effect.runPromise(renderPageArtifact(data));
  applyPublishedContentCache("page", data.artifact.artifactHash);
  return rendered;
}

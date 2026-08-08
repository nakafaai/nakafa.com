import "server-only";

import { readPublicContentEvidence } from "@repo/backend/client/content/public";
import type { RuntimeContentRoute } from "@repo/backend/convex/contents/runtime/spec";
import type { Locale } from "@repo/utilities/locales";
import { Effect, Schema } from "effect";
import { env } from "@/env";

const NAKAFA_CONTENT_BASE_URL = "https://nakafa.com";
const MATERIAL_GRAPH_KIND = "curriculum-lesson";
const MATERIAL_SECTION = "material";

interface PublishedMaterialInput {
  readonly activeReleaseId: string;
  readonly locale: Locale;
  readonly publicPath: string;
}

/** Expected signed-runtime failure while building one public API response. */
export class ApiPublishedMaterialReadError extends Schema.TaggedError<ApiPublishedMaterialReadError>()(
  "ApiPublishedMaterialReadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Maps one signed material failure into the API-owned error contract. */
function materialReadError(cause: unknown) {
  return new ApiPublishedMaterialReadError({
    cause,
    message: "Unable to read signed material content for the public API.",
  });
}

/** Reads and verifies one exact material from the active signed runtime. */
const readPublishedMaterial = Effect.fn("ApiContent.readPublishedMaterial")(
  function* (input: PublishedMaterialInput) {
    const found = yield* readPublicContentEvidence(
      {
        siteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
        token: env.CONTENT_RUNTIME_TOKEN,
      },
      {
        locale: input.locale,
        publicPath: input.publicPath,
      }
    ).pipe(Effect.mapError(materialReadError));
    if (
      found.activeReleaseId !== input.activeReleaseId ||
      found.projection.kind !== "subject-lesson"
    ) {
      return yield* materialReadError(
        "Signed material content changed release or family."
      );
    }
    return {
      artifact: found.artifact,
      projection: found.projection,
    };
  }
);

/** Builds one established partner API item from signed published content. */
export const readPublishedMaterialApiItem = Effect.fn(
  "ApiContent.readPublishedMaterialApiItem"
)(function* (input: PublishedMaterialInput) {
  const found = yield* readPublishedMaterial(input);
  const projection = found.projection;
  return {
    ...projection.graph,
    locale: projection.locale,
    metadata: {
      authors: projection.metadata.authors.map(({ name }) => ({ name })),
      date: projection.metadata.date,
      ...(projection.metadata.description === undefined
        ? {}
        : { description: projection.metadata.description }),
      ...(projection.metadata.subject === undefined
        ? {}
        : { subject: projection.metadata.subject }),
      title: projection.metadata.title,
    },
    raw: found.artifact.payload.rawMdx,
    slug: projection.contentKey,
    sourcePath: projection.contentKey,
    url: `${NAKAFA_CONTENT_BASE_URL}/${projection.locale}/${projection.publicPath}`,
  };
});

/** Builds one graph route from a signed exact material projection. */
export const readPublishedMaterialGraphRoute = Effect.fn(
  "ApiContent.readPublishedMaterialGraphRoute"
)(function* (input: PublishedMaterialInput & { readonly syncedAt: number }) {
  const found = yield* readPublishedMaterial(input);
  const projection = found.projection;
  const route: RuntimeContentRoute = {
    ...projection.graph,
    authors: projection.metadata.authors.map(({ name }) => ({ name })),
    content_id: projection.graph.assetId,
    date: Date.parse(`${projection.metadata.date}T00:00:00.000Z`),
    description: projection.metadata.description,
    kind: MATERIAL_GRAPH_KIND,
    locale: projection.locale,
    markdown: true,
    parentRoute: projection.parentPath,
    route: projection.publicPath,
    section: MATERIAL_SECTION,
    sourcePath: projection.contentKey,
    syncedAt: input.syncedAt,
    title: projection.metadata.title,
  };
  return route;
});

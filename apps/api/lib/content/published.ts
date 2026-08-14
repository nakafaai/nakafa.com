import "server-only";

import type { AppLocale } from "@nakafa/aksara-contracts/locale";
import { readPublicContentEvidence } from "@repo/backend/client/content/public";
import { Effect, Schema } from "effect";
import { env } from "@/env";

const NAKAFA_CONTENT_BASE_URL = "https://nakafa.com";

type PublishedFamily = "article" | "material";

interface PublishedContentInput {
  readonly activeReleaseId: string;
  readonly appLocale: AppLocale;
  readonly family: PublishedFamily;
  readonly publicPath: string;
}

/** Expected signed-runtime failure while building one public API response. */
export class ApiPublishedContentReadError extends Schema.TaggedError<ApiPublishedContentReadError>()(
  "ApiPublishedContentReadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Maps one signed-publication failure into the API-owned error contract. */
function publishedReadError(cause: unknown) {
  return new ApiPublishedContentReadError({
    cause,
    message: "Unable to read signed public content for the public API.",
  });
}

/** Reads and verifies one exact article or material from the signed runtime. */
const readPublishedContent = Effect.fn("ApiContent.readPublishedContent")(
  function* (input: PublishedContentInput) {
    const found = yield* readPublicContentEvidence(
      {
        siteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
        token: env.CONTENT_RUNTIME_TOKEN,
      },
      {
        appLocale: input.appLocale,
        publicPath: input.publicPath,
      }
    ).pipe(Effect.mapError(publishedReadError));
    const expectedKind =
      input.family === "article" ? "article" : "subject-lesson";
    if (
      found.activeReleaseId !== input.activeReleaseId ||
      found.projection.kind !== expectedKind ||
      found.projection.appLocale !== input.appLocale ||
      String(found.projection.publicPath) !== input.publicPath
    ) {
      return yield* publishedReadError(
        "Signed content changed its release, family, or public identity."
      );
    }
    return {
      artifact: found.artifact,
      projection: found.projection,
    };
  }
);

/** Builds one established partner item from current signed public content. */
export const readPublishedApiItem = Effect.fn(
  "ApiContent.readPublishedApiItem"
)(function* (input: PublishedContentInput) {
  const found = yield* readPublishedContent(input);
  const projection = found.projection;
  return {
    ...projection.graph,
    locale: projection.appLocale,
    metadata: {
      authors: projection.metadata.authors.map(({ name }) => ({ name })),
      date: projection.metadata.date,
      ...(projection.metadata.description === undefined
        ? {}
        : { description: projection.metadata.description }),
      ...("subject" in projection.metadata &&
      projection.metadata.subject !== undefined
        ? { subject: projection.metadata.subject }
        : {}),
      title: projection.metadata.title,
    },
    raw: found.artifact.payload.rawMdx,
    slug: projection.contentKey,
    sourcePath: projection.contentKey,
    url: `${NAKAFA_CONTENT_BASE_URL}/${projection.appLocale}/${projection.publicPath}`,
  };
});

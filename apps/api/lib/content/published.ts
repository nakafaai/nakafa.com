import "server-only";
import type { AppLocale } from "@nakafa/aksara-contracts/locale";
import { readPublicContentEvidenceBatch } from "@repo/backend/client/content/public";
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
type PublishedEvidence = Effect.Success<
  ReturnType<typeof readPublicContentEvidenceBatch>
>[number];
/** Requires one verified item to retain its page-owned public identity. */
const verifyPublishedIdentity = Effect.fn("ApiContent.verifyPublishedIdentity")(
  function* (input: PublishedContentInput, found: PublishedEvidence) {
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
    return found;
  }
);
/** Maps verified signed evidence into the established partner item. */
function makePublishedApiItem(found: PublishedEvidence) {
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
}
/** Builds one ordered partner batch from current signed public evidence. */
export const readPublishedApiItems = Effect.fn(
  "ApiContent.readPublishedApiItems"
)(function* (inputs: readonly PublishedContentInput[]) {
  const foundItems = yield* readPublicContentEvidenceBatch(
    {
      siteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
      token: env.CONTENT_RUNTIME_TOKEN,
    },
    inputs.map(({ appLocale, publicPath }) => ({ appLocale, publicPath }))
  ).pipe(Effect.mapError(publishedReadError));
  return yield* Effect.forEach(inputs, (input, index) => {
    const found = foundItems[index];
    if (!found) {
      return publishedReadError("Signed content batch lost its ordered item.");
    }
    return verifyPublishedIdentity(input, found).pipe(
      Effect.map(makePublishedApiItem)
    );
  });
});

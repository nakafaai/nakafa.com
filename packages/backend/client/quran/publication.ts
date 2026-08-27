import {
  GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import type { QuranSourceEnvelope } from "@repo/backend/convex/contentRelease/quran/spec";
import { Effect, Schema } from "effect";

const QuranPublicationOperationSchema = Schema.Literals([
  "attribution",
  "catalog",
  "document",
  "interpretation",
  "markdown",
  "reference",
  "view",
]);

export type QuranPublicationOperation =
  typeof QuranPublicationOperationSchema.Type;

/** One signed Quran response failed its exact publication contract. */
export class QuranPublicationError extends Schema.TaggedError<QuranPublicationError>()(
  "QuranPublicationError",
  {
    operation: QuranPublicationOperationSchema,
    reason: Schema.String,
  }
) {}

/** Creates one domain failure for malformed or inactive signed Quran data. */
export function quranPublicationError(
  operation: QuranPublicationOperation,
  reason: string
) {
  return new QuranPublicationError({ operation, reason });
}

const publishedQuranIdentityFields = {
  activeManifestHash: Sha256HashSchema,
  activeReleaseId: ReleaseIdSchema,
  snapshotId: Sha256HashSchema,
};
const QuranGitSourceOriginSchema = Schema.Struct({
  kind: Schema.Literal("git"),
  sha: GitCommitShaSchema,
});
const QuranRollbackSourceOriginSchema = Schema.Struct({
  kind: Schema.Literal("rollback"),
  releaseId: ReleaseIdSchema,
});
const PublishedQuranGitSourceSchema = Schema.Struct({
  ...publishedQuranIdentityFields,
  sourceOrigin: QuranGitSourceOriginSchema,
  sourceRevision: GitCommitShaSchema,
}).pipe(
  Schema.check(
    Schema.makeFilter(
      ({ sourceOrigin, sourceRevision }) => sourceOrigin.sha === sourceRevision,
      { message: "Expected the Quran Git revision to match its signed origin." }
    )
  )
);
const PublishedQuranRollbackSourceSchema = Schema.Struct({
  ...publishedQuranIdentityFields,
  sourceOrigin: QuranRollbackSourceOriginSchema,
  sourceRevision: Schema.Null,
});
const PublishedQuranSourceSchema = Schema.Union([
  PublishedQuranGitSourceSchema,
  PublishedQuranRollbackSourceSchema,
]);

export type PublishedQuranSource = typeof PublishedQuranSourceSchema.Type;

/** Requires signed release and snapshot identity with truthful provenance. */
export const decodePublishedQuranSource = Effect.fn("NakafaQuran.decodeSource")(
  function* (input: QuranSourceEnvelope, operation: QuranPublicationOperation) {
    if (!input.managed) {
      return yield* quranPublicationError(
        operation,
        "Signed Quran publication is not active."
      );
    }
    return yield* Schema.decodeUnknownEffect(PublishedQuranSourceSchema)(
      input,
      {
        onExcessProperty: "ignore",
      }
    ).pipe(
      Effect.mapError(() =>
        quranPublicationError(
          operation,
          "Signed Quran source identity is invalid."
        )
      )
    );
  }
);

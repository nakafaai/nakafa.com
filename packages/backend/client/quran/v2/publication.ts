import {
  GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  type QuranPublicationOperation,
  quranPublicationError,
} from "@repo/backend/client/quran/publication";
import type { QuranSourceEnvelope } from "@repo/backend/convex/contentRelease/quran/spec";
import { Effect, Schema } from "effect";

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
const PublishedQuranGitSourceV2Schema = Schema.Struct({
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
const PublishedQuranRollbackSourceV2Schema = Schema.Struct({
  ...publishedQuranIdentityFields,
  sourceOrigin: QuranRollbackSourceOriginSchema,
  sourceRevision: Schema.Null,
});
const PublishedQuranSourceV2Schema = Schema.Union([
  PublishedQuranGitSourceV2Schema,
  PublishedQuranRollbackSourceV2Schema,
]);

export type PublishedQuranSourceV2 = typeof PublishedQuranSourceV2Schema.Type;

/** Requires signed release and snapshot identity with truthful provenance. */
export const decodePublishedQuranSourceV2 = Effect.fn(
  "NakafaQuran.decodeSourceV2"
)(function* (input: QuranSourceEnvelope, operation: QuranPublicationOperation) {
  if (!input.managed) {
    return yield* quranPublicationError(
      operation,
      "Signed Quran publication is not active."
    );
  }
  return yield* Schema.decodeUnknownEffect(PublishedQuranSourceV2Schema)(
    input,
    { onExcessProperty: "ignore" }
  ).pipe(
    Effect.mapError(() =>
      quranPublicationError(
        operation,
        "Signed Quran source identity is invalid."
      )
    )
  );
});

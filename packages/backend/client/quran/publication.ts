import { Schema } from "effect";

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

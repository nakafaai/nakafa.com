import { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { PublishedProjectionError } from "@/lib/content/published/errors";

/** Strictly decodes optional Git provenance from one active release. */
export const decodeSourceRevision = Effect.fn(
  "NakafaContent.decodeSourceRevision"
)(function* (
  source: null | string,
  identity: { readonly locale: Locale; readonly publicPath: string }
) {
  if (source === null) {
    return null;
  }
  return yield* Schema.decodeUnknown(GitCommitShaSchema)(source).pipe(
    Effect.mapError(() => new PublishedProjectionError(identity))
  );
});

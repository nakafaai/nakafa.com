import { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import type { AppLocale } from "@nakafa/aksara-contracts/locale";
import { Effect, Schema } from "effect";
import { PublishedProjectionError } from "@/lib/content/published/errors";
/** Strictly decodes optional Git provenance from one active release. */
export const decodeSourceRevision = Effect.fn(
  "NakafaContent.decodeSourceRevision"
)(function* (
  source: null | string | undefined,
  identity: {
    readonly appLocale: AppLocale;
    readonly publicPath: string;
  }
) {
  if (source === undefined) {
    return null;
  }
  if (source === null) {
    return null;
  }
  return yield* Schema.decodeEffect(GitCommitShaSchema)(source).pipe(
    Effect.mapError(() => new PublishedProjectionError(identity))
  );
});

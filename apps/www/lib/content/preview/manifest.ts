import "server-only";
import { LocalPreviewManifestSchema } from "@nakafa/aksara-contracts/preview/spec";
import { Effect, Option, Result, Schema } from "effect";
import { cache } from "react";
import {
  decodePreviewEnvironment,
  hasPreviewConfig,
  PreviewConfigSchema,
} from "@/lib/content/preview/config";
import { readPreviewEnvironment } from "@/lib/content/preview/environment";
import { PreviewIntegrityError } from "@/lib/content/preview/errors";
import {
  fetchPreviewJsonForPrerender,
  MAX_PREVIEW_MANIFEST_BYTES,
} from "@/lib/content/preview/request";

/** Authenticated current state returned by the local Aksara provider. */
const PreviewSnapshotSchema = Schema.Struct({
  config: PreviewConfigSchema,
  manifest: LocalPreviewManifestSchema,
});
type PreviewSnapshot = typeof PreviewSnapshotSchema.Type;
type PreviewSnapshotError =
  | PreviewIntegrityError
  | Result.Result.Failure<
      Awaited<ReturnType<typeof fetchPreviewJsonForPrerender>>
    >;
/** Strictly decodes one current loopback manifest without a runtime. */
function decodeManifest(input: unknown) {
  return Result.mapError(
    Schema.decodeUnknownResult(LocalPreviewManifestSchema)(input, {
      onExcessProperty: "error",
    }),
    () => new PreviewIntegrityError({ check: "manifest" })
  );
}
/** Shares one authenticated snapshot across a single React server render. */
const readSnapshotForRender = cache(
  (): Promise<Result.Result<PreviewSnapshot, PreviewSnapshotError>> => {
    const config = decodePreviewEnvironment(readPreviewEnvironment());
    if (Result.isFailure(config)) {
      return Promise.resolve(Result.fail(config.failure));
    }
    return fetchPreviewJsonForPrerender(
      config.success,
      config.success.manifestPath,
      MAX_PREVIEW_MANIFEST_BYTES
    ).then((result) =>
      Result.flatMap(result, (input) =>
        Result.map(decodeManifest(input), (manifest) => ({
          config: config.success,
          manifest,
        }))
      )
    );
  }
);

/** Reads the same snapshot as the root revision listener in this render. */
export const readPreviewSnapshot = Effect.fn(
  "NakafaContent.readPreviewSnapshot"
)(function* () {
  if (!hasPreviewConfig()) {
    return Option.none<PreviewSnapshot>();
  }
  const snapshot = yield* Effect.promise(() => readSnapshotForRender());
  if (Result.isFailure(snapshot)) {
    return yield* snapshot.failure;
  }
  return Option.some(snapshot.success);
});
/**
 * Reads one manifest as a Promise for `generateStaticParams` and for a render
 * that has already awaited `io()`.
 */
export function readPreviewManifestForPrerender() {
  return readSnapshotForRender().then((snapshot) => {
    if (Result.isFailure(snapshot)) {
      return Promise.reject(snapshot.failure);
    }
    return snapshot.success.manifest;
  });
}

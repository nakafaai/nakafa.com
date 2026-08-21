import "server-only";
import {
  type LocalPreviewManifest,
  LocalPreviewManifestSchema,
} from "@nakafa/aksara-contracts/preview/spec";
import { Effect, Option, Result, Schema } from "effect";
import {
  decodePreviewEnvironment,
  type PreviewConfig,
  readPreviewConfig,
} from "@/lib/content/preview/config";
import { readPreviewEnvironment } from "@/lib/content/preview/environment";
import { PreviewIntegrityError } from "@/lib/content/preview/errors";
import {
  fetchPreviewJson,
  fetchPreviewJsonForPrerender,
  MAX_PREVIEW_MANIFEST_BYTES,
} from "@/lib/content/preview/request";

/** Authenticated current state returned by the local Aksara provider. */
interface PreviewSnapshot {
  readonly config: PreviewConfig;
  readonly manifest: LocalPreviewManifest;
}
/** Strictly decodes one current loopback manifest without a runtime. */
function decodeManifest(input: unknown) {
  return Result.mapError(
    Schema.decodeUnknownResult(LocalPreviewManifestSchema)(input, {
      onExcessProperty: "error",
    }),
    () => new PreviewIntegrityError({ check: "manifest" })
  );
}
/** Reads the authenticated local manifest when this development child has one. */
export const readPreviewSnapshot = Effect.fn(
  "NakafaContent.readPreviewSnapshot"
)(function* () {
  const configOption = yield* readPreviewConfig();
  if (Option.isNone(configOption)) {
    return Option.none<PreviewSnapshot>();
  }
  const config = configOption.value;
  const manifest = yield* fetchPreviewJson(
    config,
    config.manifestPath,
    MAX_PREVIEW_MANIFEST_BYTES
  );
  const decoded = decodeManifest(manifest);
  if (Result.isFailure(decoded)) {
    return yield* decoded.failure;
  }
  return Option.some({ config, manifest: decoded.success });
});
/**
 * Reads one manifest through Next's request-less static-generation Promise.
 *
 * This deliberately avoids an Effect fiber before the uncached fetch:
 * https://nextjs.org/docs/messages/next-prerender-current-time
 */
export function readPreviewManifestForPrerender() {
  const config = decodePreviewEnvironment(readPreviewEnvironment());
  if (Result.isFailure(config)) {
    return Promise.reject(config.failure);
  }
  return fetchPreviewJsonForPrerender(
    config.success,
    config.success.manifestPath,
    MAX_PREVIEW_MANIFEST_BYTES
  ).then((input) => {
    const manifest = decodeManifest(input);
    if (Result.isFailure(manifest)) {
      return Promise.reject(manifest.failure);
    }
    return manifest.success;
  });
}

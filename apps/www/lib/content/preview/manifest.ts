import "server-only";

import {
  type LocalPreviewManifest,
  LocalPreviewManifestSchema,
} from "@nakafa/aksara-contracts/preview/spec";
import { Effect, Option, Schema } from "effect";
import {
  type PreviewConfig,
  readPreviewConfig,
} from "@/lib/content/preview/config";
import { PreviewIntegrityError } from "@/lib/content/preview/errors";
import {
  fetchPreviewJson,
  MAX_PREVIEW_MANIFEST_BYTES,
} from "@/lib/content/preview/request";

/** Authenticated current state returned by the local Aksara provider. */
interface PreviewSnapshot {
  readonly config: PreviewConfig;
  readonly manifest: LocalPreviewManifest;
}

/** Strictly decodes one current loopback manifest without hidden defaults. */
function decodeManifest(input: unknown) {
  return Schema.decodeUnknown(LocalPreviewManifestSchema)(input, {
    onExcessProperty: "error",
  }).pipe(
    Effect.mapError(() => new PreviewIntegrityError({ check: "manifest" }))
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
  ).pipe(Effect.flatMap(decodeManifest));

  return Option.some({ config, manifest });
});

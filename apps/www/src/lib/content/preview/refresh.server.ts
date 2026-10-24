import { Effect, Option } from "effect";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import { readPreviewManifest } from "@/lib/content/preview/manifest";

/**
 * The revision and status of the local preview that the root document starts
 * listening from. Without a local preview there is nothing to listen to, so the
 * answer is none and the document renders no listener.
 */
export const readPreviewRefresh = Effect.fn("www.content.preview.refresh")(
  function* () {
    if (!hasPreviewConfig()) {
      return Option.none();
    }
    const manifest = yield* readPreviewManifest();
    return Option.some({
      revision: manifest.revision,
      status: manifest.status,
    });
  }
);

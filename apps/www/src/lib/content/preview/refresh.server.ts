import { hasPreviewConfig } from "@/lib/content/preview/config";
import { readPreviewManifest } from "@/lib/content/preview/manifest";
import { runServerEffect } from "@/lib/server/fn";

/**
 * The revision and status of the local preview that the root document starts
 * listening from. Without a local preview there is nothing to listen to, so the
 * answer is absent and the document renders no listener.
 */
export async function readPreviewRefreshHandler() {
  if (!hasPreviewConfig()) {
    return;
  }
  const manifest = await runServerEffect(readPreviewManifest());
  return { revision: manifest.revision, status: manifest.status };
}

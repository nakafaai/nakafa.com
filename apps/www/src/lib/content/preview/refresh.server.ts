import { hasPreviewConfig } from "@/lib/content/preview/config";
import { readPreviewManifestForPrerender } from "@/lib/content/preview/manifest";

/**
 * The revision and status of the local preview that the root document starts
 * listening from. Without a local preview there is nothing to listen to, so the
 * answer is absent and the document renders no listener.
 */
export async function readPreviewRefreshHandler() {
  if (!hasPreviewConfig()) {
    return;
  }
  const manifest = await readPreviewManifestForPrerender();
  return { revision: manifest.revision, status: manifest.status };
}

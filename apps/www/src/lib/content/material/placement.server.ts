import { readMaterialContextHint } from "@repo/contents/route/material/context";
import { Effect } from "effect";
import { readPublishedMaterialContext } from "@/lib/content/material/context";
import type { MaterialPlacement } from "@/lib/content/material/navigation";
import type { PlacementInput } from "@/lib/content/material/placement.functions";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { serverHandler } from "@/lib/server/fn";

/**
 * Verifies one reader's curriculum hint against the active release, and answers
 * the part of the placement that the lesson's links read. A hint that names no
 * program node reads as no placement without a Convex read, and the release
 * decides every other hint, so a forged one finds nothing to verify.
 */
export const readPlacement = Effect.fn("www.materials.placement.read")(
  function* (data: typeof PlacementInput.Type) {
    const context = readMaterialContextHint(data.ctx);
    if (context === undefined) {
      return null;
    }
    const published = yield* readPublishedMaterialContext(
      getLocaleOrThrow(data.locale),
      data,
      context
    );
    if (published === null) {
      return null;
    }
    const placement: MaterialPlacement = {
      context: published.context,
      hash: published.hash,
      label: published.label,
      parent: { publicPath: published.parent.publicPath },
      resolvedCanonicalPath: published.resolvedCanonicalPath,
    };
    return placement;
  }
);

/** The handler of `readMaterialPlacement`, which the server function imports on its first call. */
export const readPlacementHandler = serverHandler(readPlacement);

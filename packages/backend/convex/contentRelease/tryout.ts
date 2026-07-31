import { query } from "@repo/backend/convex/_generated/server";
import { localeValidator } from "@repo/backend/convex/contentRelease/spec";
import { readTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";

const tryoutCatalogValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  rowJson: v.array(v.string()),
  snapshotId: v.union(v.string(), v.null()),
  sourceRevision: v.union(v.string(), v.null()),
});

/** Returns the verified active try-out hierarchy for one locale. */
export const catalog = query({
  args: { locale: localeValidator },
  returns: tryoutCatalogValidator,
  handler: (ctx, { locale }) =>
    runConvexProgram(readTryoutCatalog(ctx, locale)),
});

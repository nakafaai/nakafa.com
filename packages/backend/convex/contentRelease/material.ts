import { query } from "@repo/backend/convex/_generated/server";
import { readMaterialModel } from "@repo/backend/convex/contentRelease/material/model";
import { readMaterialPage } from "@repo/backend/convex/contentRelease/material/page";
import {
  localeValidator,
  rendererDomainValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";

const materialModelValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  alternateJson: v.array(v.string()),
  managed: v.boolean(),
  projectionJson: v.union(v.string(), v.null()),
  rendererDomain: v.union(rendererDomainValidator, v.null()),
  siblingJson: v.array(v.string()),
  sourceRevision: v.union(v.string(), v.null()),
});

const materialPageValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  result: paginationResultValidator(v.string()),
  sourceRevision: v.union(v.string(), v.null()),
  stale: v.boolean(),
});

/** Resolves one complete active material shell model by localized path. */
export const route = query({
  args: { locale: localeValidator, publicPath: v.string() },
  returns: materialModelValidator,
  handler: (ctx, { locale, publicPath }) =>
    runConvexProgram(readMaterialModel(ctx, locale, publicPath)),
});

/** Returns one release-bound page of active localized material routes. */
export const page = query({
  args: {
    expectedManifestHash: v.union(v.string(), v.null()),
    expectedReleaseId: v.union(v.string(), v.null()),
    locale: localeValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: materialPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readMaterialPage(
        ctx,
        args.locale,
        args.expectedManifestHash,
        args.expectedReleaseId,
        args.paginationOpts
      )
    ),
});

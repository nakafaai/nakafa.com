import { query } from "@repo/backend/convex/_generated/server";
import { readProgramCatalog } from "@repo/backend/convex/contentRelease/program/catalog";
import { readProgramContext } from "@repo/backend/convex/contentRelease/program/context";
import { readProgramPage } from "@repo/backend/convex/contentRelease/program/page";
import { readProgramRoute } from "@repo/backend/convex/contentRelease/program/route";
import { localeValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";

const programPageValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  result: paginationResultValidator(v.string()),
  snapshotId: v.union(v.string(), v.null()),
  sourceRevision: v.union(v.string(), v.null()),
  stale: v.boolean(),
});

const programCatalogValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  programJson: v.array(v.string()),
  routeJson: v.array(v.string()),
  snapshotId: v.union(v.string(), v.null()),
  sourceRevision: v.union(v.string(), v.null()),
});

const programRouteValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  alternateJson: v.array(v.string()),
  ancestorJson: v.array(v.string()),
  childJson: v.array(v.string()),
  contextJson: v.array(v.string()),
  groupJson: v.array(v.string()),
  managed: v.boolean(),
  materialJson: v.array(v.string()),
  programJson: v.union(v.string(), v.null()),
  routeJson: v.union(v.string(), v.null()),
  snapshotId: v.union(v.string(), v.null()),
  sourceRevision: v.union(v.string(), v.null()),
});

const programContextValidator = v.object({
  groupJson: v.union(v.string(), v.null()),
  managed: v.boolean(),
  parentJson: v.union(v.string(), v.null()),
});

/** Returns the bounded learning-program catalog and localized root routes. */
export const catalog = query({
  args: { locale: localeValidator },
  returns: programCatalogValidator,
  handler: (ctx, { locale }) =>
    runConvexProgram(readProgramCatalog(ctx, locale)),
});

/** Resolves a validated curriculum return context for one material route. */
export const context = query({
  args: {
    locale: localeValidator,
    materialKey: v.string(),
    nodeKey: v.string(),
    programKey: v.string(),
  },
  returns: programContextValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readProgramContext(
        ctx,
        args.locale,
        args.programKey,
        args.nodeKey,
        args.materialKey
      )
    ),
});

/** Returns one release-bound page of localized curriculum routes. */
export const page = query({
  args: {
    expectedManifestHash: v.union(v.string(), v.null()),
    expectedReleaseId: v.union(v.string(), v.null()),
    locale: localeValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: programPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      readProgramPage(
        ctx,
        args.locale,
        args.expectedManifestHash,
        args.expectedReleaseId,
        args.paginationOpts
      )
    ),
});

/** Resolves one complete indexed curriculum page model by public path. */
export const route = query({
  args: { locale: localeValidator, publicPath: v.string() },
  returns: programRouteValidator,
  handler: (ctx, { locale, publicPath }) =>
    runConvexProgram(readProgramRoute(ctx, locale, publicPath)),
});

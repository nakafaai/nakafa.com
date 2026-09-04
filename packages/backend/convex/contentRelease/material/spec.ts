import {
  appLocaleValidator,
  rendererDomainValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { v } from "convex/values";

/** Complete signed material shell returned by route and runtime readers. */
export const materialModelValidator = v.object({
  activeManifestHash: v.union(v.string(), v.null()),
  activeAppLocales: v.array(appLocaleValidator),
  activeReleaseId: v.union(v.string(), v.null()),
  alternateJson: v.array(v.string()),
  projectionJson: v.union(v.string(), v.null()),
  rendererDomain: v.union(rendererDomainValidator, v.null()),
  siblingJson: v.array(v.string()),
  sourcePath: v.union(v.string(), v.null()),
  sourceRevision: v.union(v.string(), v.null()),
});

/** One signed-publication row selected for the partner API. */
export const materialApiEntryValidator = v.object({
  appLocale: appLocaleValidator,
  publicPath: v.string(),
});

/** Bounded material partner page selected in one Convex transaction. */
export const materialApiPageValidator = v.object({
  activeReleaseId: v.string(),
  continueCursor: v.string(),
  isDone: v.boolean(),
  page: v.array(materialApiEntryValidator),
});

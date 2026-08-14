import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { v } from "convex/values";

/** One signed article selected for partner API hydration. */
export const articleApiEntryValidator = v.object({
  appLocale: appLocaleValidator,
  publicPath: v.string(),
});

/** Bounded article partner page selected from the current catalog. */
export const articleApiPageValidator = v.object({
  activeReleaseId: v.string(),
  continueCursor: v.string(),
  isDone: v.boolean(),
  page: v.array(articleApiEntryValidator),
});

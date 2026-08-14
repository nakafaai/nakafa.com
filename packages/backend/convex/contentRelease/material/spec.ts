import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { v } from "convex/values";

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

import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { contentSearchSummaryValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import { type Infer, v } from "convex/values";

/** Current semantic content identity accepted by public reference readers. */
export const contentReferenceInputValidator = v.union(
  v.object({
    contentId: v.string(),
    kind: v.literal("content"),
  }),
  v.object({
    kind: v.literal("route"),
    appLocale: appLocaleValidator,
    publicPath: v.string(),
  })
);

/** Input type derived from the public current reference validator. */
export type ContentReferenceInput = Infer<
  typeof contentReferenceInputValidator
>;

/** One current authenticated public content summary, or no exact match. */
export const contentReferenceReturnValidator = v.union(
  contentSearchSummaryValidator,
  v.null()
);

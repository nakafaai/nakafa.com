import { learningContextInputValidator } from "@repo/backend/confect/contents/context";
import { contentViewSectionValidator } from "@repo/backend/confect/contents/views/section";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { Schema } from "effect";

/**
 * Client-side graph content-view recording configuration. Browser modules
 * import this Schema type-only, so its validators stay out of the bundle.
 */
export const UseRecordContentViewOptionsSchema = Schema.Struct({
  contentId: Schema.optionalKey(Schema.NullOr(Schema.String)),
  context: Schema.optionalKey(learningContextInputValidator),
  delay: Schema.optionalKey(Schema.Finite),
  locale: localeValidator,
  publicPath: Schema.String,
  section: contentViewSectionValidator,
});

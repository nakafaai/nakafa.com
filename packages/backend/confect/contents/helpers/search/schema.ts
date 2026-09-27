import { learningGraphIdentityValidator } from "@repo/backend/confect/contents/graph";
import {
  localeValidator,
  nakafaSectionValidator,
} from "@repo/backend/confect/lib/validators/contents";
import { Schema } from "effect";
export const contentSearchRefValidator = Schema.Struct({
  ...learningGraphIdentityValidator.fields,
  content_id: Schema.String,
  locale: localeValidator,
  markdown_url: Schema.optionalKey(Schema.String),
  route: Schema.String,
  section: nakafaSectionValidator,
  url: Schema.String,
});
export const contentSearchSummaryValidator = Schema.Struct({
  ...contentSearchRefValidator.fields,
  description: Schema.String,
  title: Schema.String,
});
export const contentSearchResultItemValidator = Schema.Struct({
  ...contentSearchSummaryValidator.fields,
  excerpt: Schema.String,
});
export const contentSearchInputValidator = Schema.Struct({
  limit: Schema.Finite,
  locale: localeValidator,
  offset: Schema.Finite,
  queries: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
  section: Schema.optionalKey(nakafaSectionValidator),
});
export const contentSearchResultValidator = Schema.Struct({
  count: Schema.Finite,
  has_more: Schema.Boolean,
  items: Schema.mutable(Schema.Array(contentSearchResultItemValidator)),
  limit: Schema.Finite,
  next_offset: Schema.optionalKey(Schema.Finite),
  offset: Schema.Finite,
});
export const contentSearchDocumentValidator = Schema.Struct({
  ...contentSearchSummaryValidator.fields,
  contentHash: Schema.String,
  sourcePath: Schema.String,
  syncedAt: Schema.Finite,
  text: Schema.String,
});

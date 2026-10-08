import { contentSearchSummaryValidator } from "@repo/backend/confect/contents/helpers/search/schema";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { quranMarkdownValidator } from "@repo/backend/content/quran/contract";
import { Schema } from "effect";
/** Current semantic content identity accepted by public reference readers. */
export const contentReferenceInputValidator = Schema.Union([
  Schema.Struct({
    contentId: Schema.String,
    kind: Schema.Literal("content"),
  }),
  Schema.Struct({
    kind: Schema.Literal("route"),
    appLocale: localeValidator,
    publicPath: Schema.String,
  }),
]);

/** Input type derived from the public current reference validator. */
export type ContentReferenceInput = typeof contentReferenceInputValidator.Type;

/** One current authenticated public content summary, or no exact match. */
export const contentReferenceReturnValidator = Schema.Union([
  contentSearchSummaryValidator,
  Schema.Null,
]);
/** One transactionally consistent source for an agent focused read. */
export const agentContentSourceValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("reference"),
    reference: contentSearchSummaryValidator,
  }),
  Schema.Struct({
    kind: Schema.Literal("quran"),
    markdown: quranMarkdownValidator,
    reference: contentSearchSummaryValidator,
    surahNumber: Schema.Finite,
  }),
  Schema.Null,
]);

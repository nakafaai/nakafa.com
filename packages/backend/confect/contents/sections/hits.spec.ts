import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { contentSearchSummaryValidator } from "@repo/backend/confect/contents/search/schema";
import {
  localeValidator,
  nakafaSectionValidator,
} from "@repo/backend/confect/lib/validators/contents";
import { Schema } from "effect";

/**
 * A section that a search found, as a pointer: where it is (the identity of
 * its document, its language, its anchor, its heading path), what it says in
 * short, and the verified reference of the document that holds it.
 */
const hitValidator = Schema.Struct({
  anchor: Schema.String,
  appLocale: localeValidator,
  contentKey: Schema.String,
  excerpt: Schema.String,
  headingPath: Schema.Array(Schema.String),
  ordinal: Schema.Finite,
  reference: contentSearchSummaryValidator,
});
export type Hit = typeof hitValidator.Type;

/** What a search asks of the stored sections once the vector search has found its candidates. */
export const hitsInputValidator = Schema.Struct({
  ids: Schema.Array(Id("contentSections")),
  limit: Schema.Finite,
  locale: localeValidator,
  query: Schema.String,
  section: Schema.optionalKey(nakafaSectionValidator),
});

/** The ranked sections, or `empty` when the index cannot answer: its build for the active release has not finished, or it holds nothing near the question. */
export const hitsResultValidator = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("empty") }),
  Schema.Struct({
    hits: Schema.Array(hitValidator),
    kind: Schema.Literal("hits"),
  }),
]);

/**
 * Finishes a search: it adds the sections found by words to those found by
 * meaning, merges the two lists into one ranking, keeps the best section of
 * each document, gives each in the language of the learner, and keeps those
 * whose document is still published.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalQuery({
    name: "resolve",
    args: () => hitsInputValidator.fields,
    returns: () => hitsResultValidator,
    error: () => ReleaseError,
  })
);

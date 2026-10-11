import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { hitsResultValidator } from "@repo/backend/confect/contents/sections/hits.spec";
import {
  GatewayConfigurationError,
  GatewayFailure,
} from "@repo/backend/confect/gateway/failure";
import {
  localeValidator,
  nakafaSectionValidator,
} from "@repo/backend/confect/lib/validators/contents";
import { Schema } from "effect";

/** A question, the language of the learner, how many sections to return, and the kind of content to search. */
export const searchInputValidator = Schema.Struct({
  limit: Schema.optionalKey(Schema.Finite),
  locale: localeValidator,
  query: Schema.String,
  section: Schema.optionalKey(nakafaSectionValidator),
});

/**
 * Finds the sections of Nakafa lessons, articles, and the Quran that answer a
 * question, by meaning and by words at once, in the language of the learner.
 * It returns pointers: the document and the section to open with the reader.
 */
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "search",
    args: () => searchInputValidator.fields,
    returns: () => hitsResultValidator,
    error: () =>
      Schema.Union([GatewayConfigurationError, GatewayFailure, ReleaseError]),
  })
);

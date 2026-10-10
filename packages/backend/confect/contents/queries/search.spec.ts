import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { ContentSearchInputError } from "@repo/backend/confect/contents/search/input";
import {
  contentSearchInputValidator,
  contentSearchResultValidator,
} from "@repo/backend/confect/contents/search/schema";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "search",
    args: () => contentSearchInputValidator.fields,
    returns: () => contentSearchResultValidator,
    error: () => Schema.Union([ReleaseError, ContentSearchInputError]),
  })
);

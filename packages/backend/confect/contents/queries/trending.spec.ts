import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import {
  getTrendingSubjectsArgs,
  getTrendingSubjectsResultValidator,
  TrendingSubjectIoErrorWire,
} from "@repo/backend/confect/contents/trending/spec";
import { ContentViewIoErrorWire } from "@repo/backend/confect/contents/views/spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "getTrendingSubjects",
    args: () => getTrendingSubjectsArgs,
    returns: () => getTrendingSubjectsResultValidator,
    error: () =>
      Schema.Union([
        TrendingSubjectIoErrorWire,
        ReleaseErrorWire,
        ContentViewIoErrorWire,
      ]),
  })
);

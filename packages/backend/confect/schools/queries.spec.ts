import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { SchoolReadFailure } from "@repo/backend/confect/schools/errors";
import {
  mySchoolsPageArgs,
  mySchoolsPageResultValidator,
  schoolBySlugResultValidator,
  schoolLandingStateResultValidator,
} from "@repo/backend/confect/schools/validators";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getSchoolBySlug",
      args: () => ({
        slug: Schema.String,
      }),
      returns: () => schoolBySlugResultValidator,
      error: () => Schema.Union([AuthFailure, SchoolReadFailure]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getMySchoolLandingState",
      args: () => ({}),
      returns: () => schoolLandingStateResultValidator,
      error: () => Schema.Union([AuthFailure, SchoolReadFailure]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getMySchoolsPage",
      args: () => mySchoolsPageArgs,
      returns: () => mySchoolsPageResultValidator,
      error: () => Schema.Union([AuthFailure, SchoolReadFailure]),
    })
  );

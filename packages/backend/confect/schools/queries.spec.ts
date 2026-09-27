import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { SchoolReadError } from "@repo/backend/confect/schools/errors";
import {
  schoolBySlugResultValidator,
  schoolLandingStateResultValidator,
  schoolSummaryValidator,
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
      error: () => Schema.Union([AuthFailure, SchoolReadError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getMySchoolLandingState",
      args: () => ({}),
      returns: () => schoolLandingStateResultValidator,
      error: () => Schema.Union([AuthFailure, SchoolReadError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "getMySchoolsPage",
      item: () => schoolSummaryValidator,
      error: () => Schema.Union([AuthFailure, SchoolReadError]),
    }).middleware(Session)
  );

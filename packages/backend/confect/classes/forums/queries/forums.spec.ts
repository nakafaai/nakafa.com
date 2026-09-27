import { FunctionSpec, GroupSpec } from "@confect/core";
import { PaginationOptions as PaginationOptionsSchema } from "@confect/core/PaginationOptions";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccessFailure } from "@repo/backend/confect/classes/access/spec";
import { ForumFailure } from "@repo/backend/confect/classes/forums/spec";
import {
  forumDetailValidator,
  paginatedForumsValidator,
} from "@repo/backend/confect/classes/forums/validators";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getForums",
      args: () => ({
        classId: IdSchema("schoolClasses"),
        paginationOpts: PaginationOptionsSchema,
        q: Schema.optionalKey(Schema.String),
      }),
      returns: () => paginatedForumsValidator,
      error: () => Schema.Union([AuthFailure, ClassAccessFailure]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getForum",
      args: () => ({
        forumId: IdSchema("schoolClassForums"),
      }),
      returns: () => forumDetailValidator,
      error: () =>
        Schema.Union([AuthFailure, ForumFailure, ClassAccessFailure]),
    })
  );

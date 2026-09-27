import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccessError } from "@repo/backend/confect/classes/access/spec";
import { ForumError } from "@repo/backend/confect/classes/forums/spec";
import {
  forumDetailValidator,
  forumListItemValidator,
} from "@repo/backend/confect/classes/forums/validators";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "getForums",
      args: () => ({
        classId: IdSchema("schoolClasses"),
        q: Schema.optionalKey(Schema.String),
      }),
      item: () => forumListItemValidator,
      error: () => Schema.Union([AuthFailure, ClassAccessError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getForum",
      args: () => ({
        forumId: IdSchema("schoolClassForums"),
      }),
      returns: () => forumDetailValidator,
      error: () => Schema.Union([AuthFailure, ForumError, ClassAccessError]),
    }).middleware(Session)
  );

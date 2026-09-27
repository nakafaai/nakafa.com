import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccessError } from "@repo/backend/confect/classes/access/spec";
import { classMemberWithUserValidator } from "@repo/backend/confect/classes/validators";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicPaginatedQuery({
    name: "list",
    args: () => ({
      classId: Id("schoolClasses"),
      q: Schema.optionalKey(Schema.String),
    }),
    item: () => classMemberWithUserValidator,
    error: () => Schema.Union([AuthFailure, ClassAccessError]),
  }).middleware(Session)
);

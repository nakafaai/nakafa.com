import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import schoolClassesTable from "@repo/backend/confect/_generated/tables/schoolClasses";
import schoolClassInviteCodesTable from "@repo/backend/confect/_generated/tables/schoolClassInviteCodes";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccessError } from "@repo/backend/confect/classes/access/spec";
import { schoolClassVisibilityValidator } from "@repo/backend/confect/classes/schema";
import {
  classMemberWithUserValidator,
  classRouteResultValidator,
} from "@repo/backend/confect/classes/validators";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";
export class ClassQueryError extends Schema.TaggedError<ClassQueryError>()(
  "ClassQueryError",
  {
    code: Schema.Literals([
      "CLASS_MEMBER_SEARCH_LIMIT_EXCEEDED",
      "CLASS_MEMBER_COUNT_EXCEEDED",
      "INVALID_PAGINATION_CURSOR",
      "INVALID_PAGINATION_LIMIT",
      "CLASS_INVITE_CODE_LIMIT_EXCEEDED",
    ]),
    message: Schema.String,
  }
) {}
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "getClasses",
      args: () => ({
        schoolId: IdSchema("schools"),
        q: Schema.optionalKey(Schema.String),
        isArchived: Schema.optionalKey(Schema.Boolean),
        visibility: Schema.optionalKey(schoolClassVisibilityValidator),
      }),
      item: () => schoolClassesTable.Doc,
      error: () => Schema.Union([AuthFailure, ClassAccessError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getClassRoute",
      args: () => ({
        classId: Schema.String,
      }),
      returns: () => classRouteResultValidator,
      error: () => Schema.Union([AuthFailure, ClassAccessError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "getPeople",
      args: () => ({
        classId: IdSchema("schoolClasses"),
        q: Schema.optionalKey(Schema.String),
      }),
      item: () => classMemberWithUserValidator,
      error: () =>
        Schema.Union([AuthFailure, ClassAccessError, ClassQueryError]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getInviteCodes",
      args: () => ({
        classId: IdSchema("schoolClasses"),
      }),
      returns: () => Schema.Array(schoolClassInviteCodesTable.Doc),
      error: () =>
        Schema.Union([AuthFailure, ClassAccessError, ClassQueryError]),
    }).middleware(Session)
  );

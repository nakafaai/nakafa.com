import { FunctionSpec, GroupSpec } from "@confect/core";
import { PaginationOptions as PaginationOptionsSchema } from "@confect/core/PaginationOptions";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import schoolClassInviteCodesTable from "@repo/backend/confect/_generated/tables/schoolClassInviteCodes";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccessFailure } from "@repo/backend/confect/classes/access/spec";
import { schoolClassVisibilityValidator } from "@repo/backend/confect/classes/schema";
import {
  classRouteResultValidator,
  paginatedClassesValidator,
  paginatedPeopleValidator,
} from "@repo/backend/confect/classes/validators";
import { failureWire } from "@repo/backend/confect/failure";
import { Schema } from "effect";
export class ClassQueryError extends Schema.TaggedError<ClassQueryError>()(
  "ClassQueryError",
  {
    code: Schema.Literals([
      "CLASS_MEMBER_SEARCH_LIMIT_EXCEEDED",
      "CLASS_MEMBER_COUNT_EXCEEDED",
      "INVALID_PAGINATION_CURSOR",
      "CLASS_INVITE_CODE_LIMIT_EXCEEDED",
    ]),
    message: Schema.String,
  }
) {}
export const ClassQueryFailure = failureWire(ClassQueryError);
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getClasses",
      args: () => ({
        schoolId: IdSchema("schools"),
        q: Schema.optionalKey(Schema.String),
        isArchived: Schema.optionalKey(Schema.Boolean),
        visibility: Schema.optionalKey(schoolClassVisibilityValidator),
        paginationOpts: PaginationOptionsSchema,
      }),
      returns: () => paginatedClassesValidator,
      error: () => Schema.Union([AuthFailure, ClassAccessFailure]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getClassRoute",
      args: () => ({
        classId: Schema.String,
      }),
      returns: () => classRouteResultValidator,
      error: () => Schema.Union([AuthFailure, ClassAccessFailure]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getPeople",
      args: () => ({
        classId: IdSchema("schoolClasses"),
        q: Schema.optionalKey(Schema.String),
        paginationOpts: PaginationOptionsSchema,
      }),
      returns: () => paginatedPeopleValidator,
      error: () =>
        Schema.Union([AuthFailure, ClassAccessFailure, ClassQueryFailure]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getInviteCodes",
      args: () => ({
        classId: IdSchema("schoolClasses"),
      }),
      returns: () => Schema.Array(schoolClassInviteCodesTable.Doc),
      error: () =>
        Schema.Union([AuthFailure, ClassAccessFailure, ClassQueryFailure]),
    })
  );

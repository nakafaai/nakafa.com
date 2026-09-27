import { FunctionSpec, GroupSpec } from "@confect/core";
import { PaginationOptions as PaginationOptionsSchema } from "@confect/core/PaginationOptions";
import { PaginationResult as PaginationResultSchema } from "@confect/core/PaginationResult";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import schoolClassMaterialGroups from "@repo/backend/confect/_generated/tables/schoolClassMaterialGroups";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccessFailure } from "@repo/backend/confect/classes/access/spec";
import { userDataValidator } from "@repo/backend/confect/lib/validators/user";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "getMaterialGroups",
    args: () => ({
      classId: IdSchema("schoolClasses"),
      parentId: Schema.optionalKey(IdSchema("schoolClassMaterialGroups")),
      q: Schema.optionalKey(Schema.String),
      paginationOpts: PaginationOptionsSchema,
    }),
    returns: () =>
      PaginationResultSchema(
        Schema.Struct({
          ...schoolClassMaterialGroups.Doc.fields,
          ...{
            user: Schema.NullOr(userDataValidator),
            publishedByUser: Schema.NullOr(userDataValidator),
          },
        })
      ),
    error: () => Schema.Union([AuthFailure, ClassAccessFailure]),
  })
);

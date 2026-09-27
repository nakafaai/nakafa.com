import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import schoolClassMaterialGroups from "@repo/backend/confect/_generated/tables/schoolClassMaterialGroups";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ClassAccessError } from "@repo/backend/confect/classes/access/spec";
import { userDataValidator } from "@repo/backend/confect/lib/validators/user";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicPaginatedQuery({
    name: "getMaterialGroups",
    args: () => ({
      classId: IdSchema("schoolClasses"),
      parentId: Schema.optionalKey(IdSchema("schoolClassMaterialGroups")),
      q: Schema.optionalKey(Schema.String),
    }),
    item: () =>
      Schema.Struct({
        ...schoolClassMaterialGroups.Doc.fields,
        ...{
          user: Schema.NullOr(userDataValidator),
          publishedByUser: Schema.NullOr(userDataValidator),
        },
      }),
    error: () => Schema.Union([AuthFailure, ClassAccessError]),
  }).middleware(Session)
);

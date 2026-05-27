import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { PaginationResult } from "@confect/core/PaginationResult";
import { SchoolClassMaterialGroups } from "@repo/backend/confect/modules/school/classes.tables";
import { Schema } from "effect";

const classesMaterialsQueriesGroup = GroupSpec.make("queries").addFunction(
  FunctionSpec.publicQuery({
    name: "getMaterialGroups",
    args: Schema.Struct({
      classId: GenericId.GenericId("schoolClasses"),
      paginationOpts: Schema.Struct({
        cursor: Schema.Union(Schema.String, Schema.Null),
        endCursor: Schema.optional(Schema.Union(Schema.String, Schema.Null)),
        id: Schema.optional(Schema.Number),
        maximumBytesRead: Schema.optional(Schema.Number),
        maximumRowsRead: Schema.optional(Schema.Number),
        numItems: Schema.Number,
      }),
      parentId: Schema.optional(
        GenericId.GenericId("schoolClassMaterialGroups")
      ),
      q: Schema.optional(Schema.String),
    }),
    returns: PaginationResult(SchoolClassMaterialGroups.Doc),
  })
);

export { classesMaterialsQueriesGroup };

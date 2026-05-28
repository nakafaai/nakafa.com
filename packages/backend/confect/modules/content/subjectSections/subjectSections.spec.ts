import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  gradeSchema,
  localeSchema,
  materialSchema,
} from "@repo/backend/confect/modules/content/content.schemas";
import { Schema } from "effect";

const subjectSectionsQueriesGroup = GroupSpec.make("queries").addFunction(
  FunctionSpec.publicQuery({
    name: "getTrendingSubjects",
    args: Schema.Struct({
      limit: Schema.optional(Schema.Number),
      locale: localeSchema,
      minViews: Schema.optional(Schema.Number),
      since: Schema.Number,
      until: Schema.Number,
    }),
    returns: Schema.Array(
      Schema.Struct({
        description: Schema.optional(Schema.String),
        grade: gradeSchema,
        id: GenericId.GenericId("subjectSections"),
        material: materialSchema,
        slug: Schema.String,
        title: Schema.String,
        viewCount: Schema.Number,
      })
    ),
  })
);

export { subjectSectionsQueriesGroup };

const subjectSectionsGroup = GroupSpec.make("subjectSections").addGroup(
  subjectSectionsQueriesGroup
);

export { subjectSectionsGroup };

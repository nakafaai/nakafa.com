import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { localeSchema } from "@repo/backend/confect/modules/content/content.schemas";
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
        grade: Schema.Literal(
          "1",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
          "8",
          "9",
          "10",
          "11",
          "12",
          "bachelor",
          "master",
          "phd"
        ),
        id: GenericId.GenericId("subjectSections"),
        material: Schema.Literal(
          "mathematics",
          "physics",
          "chemistry",
          "biology",
          "geography",
          "economy",
          "history",
          "informatics",
          "geospatial",
          "sociology",
          "ai-ds",
          "game-engineering",
          "computer-science",
          "technology-electro-medical",
          "political-science",
          "informatics-engineering",
          "international-relations"
        ),
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

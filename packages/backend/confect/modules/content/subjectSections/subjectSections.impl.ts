import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { getTrendingSubjects } from "@repo/backend/confect/modules/content/subjectSections.service";
import { Effect, Layer } from "effect";

const subjectSections_queries_getTrendingSubjectsImpl = FunctionImpl.make(
  api,
  "subjectSections.queries",
  "getTrendingSubjects",
  (args) =>
    getTrendingSubjects(args).pipe(
      Effect.catchTag("TrendingRangeError", (error) => Effect.die(error)),
      Effect.orDie
    )
);
const subjectSectionsQueriesImpl = GroupImpl.make(
  api,
  "subjectSections.queries"
).pipe(Layer.provide(subjectSections_queries_getTrendingSubjectsImpl));
const subjectSectionsImpl = GroupImpl.make(api, "subjectSections").pipe(
  Layer.provide(subjectSectionsQueriesImpl)
);
export const subjectSectionsLayer = Layer.mergeAll(subjectSectionsImpl);

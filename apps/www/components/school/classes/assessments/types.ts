import type {
  api,
  FunctionReturnType,
} from "@repo/backend/confect/_generated/functionReferences";

/** One authored assessment row returned by the class assessments paginated query. */
export type Assessment = FunctionReturnType<
  typeof api.assessments.queries.publicFunctions.list.listAssessments
>["page"][number];

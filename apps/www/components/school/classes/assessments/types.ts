import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

/** One authored assessment row returned by the class assessments paginated query. */
export type Assessment = FunctionReturnType<
  typeof api.assessments.queries.public.assessmentList.listAssessments
>["page"][number];

import type refs from "@repo/backend/confect/_generated/refs";
import type { ConvexFunctionReturn } from "@repo/backend/confect/modules/shared/convexReferences";

/** One authored assessment row returned by the class assessments paginated query. */
export type Assessment = ConvexFunctionReturn<
  typeof refs.public.assessments.queries.publicFunctions.list.listAssessments
>["page"][number];

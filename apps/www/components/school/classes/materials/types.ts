import type refs from "@repo/backend/confect/_generated/refs";
import type { ConvexFunctionReturn } from "@repo/backend/confect/modules/shared/convexReferences";

/** One material group row returned by the class materials paginated query. */
export type MaterialGroup = ConvexFunctionReturn<
  typeof refs.public.classes.materials.queries.getMaterialGroups
>["page"][number];

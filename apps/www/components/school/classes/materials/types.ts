import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

/** One material group row returned by the class materials paginated query. */
export type MaterialGroup = FunctionReturnType<
  typeof api.classes.materials.queries.getMaterialGroups
>["page"][number];

import type {
  api,
  FunctionReturnType,
} from "@repo/backend/confect/_generated/functionReferences";

/** One material group row returned by the class materials paginated query. */
export type MaterialGroup = FunctionReturnType<
  typeof api.classes.materials.queries.getMaterialGroups
>["page"][number];

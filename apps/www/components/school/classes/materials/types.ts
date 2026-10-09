import type { Ref } from "@confect/core";
import type classes from "@repo/backend/confect/_generated/refs/classes";

/** One material group row returned by the class materials paginated query. */
export type MaterialGroup = Ref.Returns<
  typeof classes.materials.queries.getMaterialGroups
>["page"][number];

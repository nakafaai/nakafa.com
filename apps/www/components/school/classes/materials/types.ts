import type { Ref } from "@confect/core";
import type refs from "@repo/backend/confect/_generated/refs";

/** One material group row returned by the class materials paginated query. */
export type MaterialGroup = Ref.Returns<
  typeof refs.public.classes.materials.queries.getMaterialGroups
>["page"][number];

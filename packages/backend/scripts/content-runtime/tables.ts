import contentReleaseSchema from "@repo/backend/convex/contentRelease/schema";
import routeSchema from "@repo/backend/convex/contents/schema/routes";

const ACTIVE_POINTER_TABLE = "contentState";

/** Public signed-runtime tables copied into one isolated Agent Mode deployment. */
export const CONTENT_RUNTIME_TABLES = Object.freeze([
  ...Object.keys(contentReleaseSchema).filter(
    (table) => table !== ACTIVE_POINTER_TABLE
  ),
  ...Object.keys(routeSchema),
  ACTIVE_POINTER_TABLE,
]);

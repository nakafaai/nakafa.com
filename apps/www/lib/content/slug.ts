import { cleanSlug } from "@repo/utilities/helper";

/** Converts a public content path into the slashless Convex runtime slug. */
export function getContentRuntimeSlug(path: string) {
  return cleanSlug(path);
}

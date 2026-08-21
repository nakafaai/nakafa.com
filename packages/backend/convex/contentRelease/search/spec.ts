import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import type { Infer } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Content families represented in the public learning-search read model. */
export const SEARCH_FAMILIES = [
  "article",
  "material",
] as const satisfies readonly ContentFamily[];
export const searchFamilyValidator = literals(...SEARCH_FAMILIES);
export type SearchFamily = Infer<typeof searchFamilyValidator>;

/** Narrows one signed release family to the learning-search domain. */
export function isSearchFamily(family: ContentFamily): family is SearchFamily {
  return SEARCH_FAMILIES.some((candidate) => candidate === family);
}

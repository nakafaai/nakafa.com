import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import { Array as Arr, Schema } from "effect";
/** Content families represented in the public learning-search read model. */
export const SEARCH_FAMILIES = [
  "article",
  "material",
] as const satisfies readonly ContentFamily[];
export const searchFamilyValidator = Schema.Literals([...SEARCH_FAMILIES]);
export type SearchFamily = typeof searchFamilyValidator.Type;

/** Narrows one signed release family to the learning-search domain. */
export function isSearchFamily(family: ContentFamily): family is SearchFamily {
  return Arr.some(SEARCH_FAMILIES, (candidate) => candidate === family);
}

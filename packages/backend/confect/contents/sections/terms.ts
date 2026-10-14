import {
  CONVEX_SEARCH_TERM_BYTES,
  CONVEX_SEARCH_TERMS,
} from "@repo/contents/agent/search";
import { Array as Arr } from "effect";

const TERM = /[\p{L}\p{N}]+/gu;
const encoder = new TextEncoder();

/**
 * Reduces a question to the terms that Convex full-text search accepts: its
 * first sixteen words and numbers, without those that are too long to be a
 * search term. A question longer than that is not an error but a text query
 * about its first words. The result is empty when no usable term is left.
 */
export function textQuery(query: string) {
  return Arr.join(
    Arr.take(
      Arr.filter(
        Arr.map(Arr.fromIterable(query.matchAll(TERM)), ([term]) => term),
        (term) => encoder.encode(term).byteLength < CONVEX_SEARCH_TERM_BYTES
      ),
      CONVEX_SEARCH_TERMS
    ),
    " "
  );
}

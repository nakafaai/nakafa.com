import {
  TEXT_QUERY_TERMS,
  TEXT_TERM_BYTES,
} from "@repo/backend/confect/contents/sections/limits";
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
        (term) => encoder.encode(term).byteLength < TEXT_TERM_BYTES
      ),
      TEXT_QUERY_TERMS
    ),
    " "
  );
}

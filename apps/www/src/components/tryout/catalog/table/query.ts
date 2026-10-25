import {
  setDirectionValidator,
  setFilterValidator,
  setSortValidator,
} from "@repo/backend/confect/tryouts/sets/spec";
import { Effect, Schema } from "effect";

const DEFAULT_STATUS: typeof setFilterValidator.Type = "all";
const DEFAULT_SORT: typeof setSortValidator.fields.field.Type = "order";
const DEFAULT_DIRECTION: typeof setDirectionValidator.Type = "asc";

/**
 * The catalog query of a track page: its status filter, sort field and direction.
 * Each value decodes on its own to its literal, so an absent or malformed value
 * decodes to its default, and one bad value keeps the other two. The literals are
 * the ones the catalog query accepts.
 */
export const CatalogQuery = Schema.Struct({
  direction: setDirectionValidator.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(DEFAULT_DIRECTION)),
    Schema.catchDecoding(() => Effect.succeedSome(DEFAULT_DIRECTION))
  ),
  sort: setSortValidator.fields.field.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(DEFAULT_SORT)),
    Schema.catchDecoding(() => Effect.succeedSome(DEFAULT_SORT))
  ),
  status: setFilterValidator.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(DEFAULT_STATUS)),
    Schema.catchDecoding(() => Effect.succeedSome(DEFAULT_STATUS))
  ),
});
export type CatalogQuery = typeof CatalogQuery.Type;

/** The values that the URL leaves out: every set, in authored order, ascending. */
export const CATALOG_QUERY_DEFAULTS = Schema.decodeSync(CatalogQuery)({});

/**
 * The loader's dependency of a track page. The router keys each match by the JSON of
 * its dependency, and a validated search keeps the key order of the address, so the
 * dependency lists the three keys in one fixed order. An address that spells the
 * defaults out then keys the same match as the canonical address, which loads once.
 */
export function catalogLoaderDeps(search: CatalogQuery): CatalogQuery {
  return {
    direction: search.direction,
    sort: search.sort,
    status: search.status,
  };
}

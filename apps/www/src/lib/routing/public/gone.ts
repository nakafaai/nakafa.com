import { LocaleSchema } from "@repo/internationalization/src/locale";
import { Array as Arr, HashSet, Schema } from "effect";
import { readPathSegments } from "@/lib/routing/public/tryout/route";

/**
 * The first segment, after the locale or without one, of every address family
 * that an earlier version of the site served and that no page took over: the
 * question pages, the exercise and practice schemes, and the subject scheme, whose
 * lessons that still exist the migrations redirect before this answers. Search
 * Console listed thousands of them as not found on 13 November 2026.
 */
const GONE_FAMILIES = HashSet.make(
  "ask",
  "exercises",
  "latihan",
  "practice",
  "subject"
);

/** The asset folder of the framework the site no longer runs. */
const RETIRED_ASSETS = "_next";

/** The folder of the sitemap shards. */
const SITEMAP_FOLDER = "sitemap";

/**
 * A sitemap shard of an earlier sitemap index, named by a three-character hash.
 * The live shards are named `{kind}_{locale}_p{N}.xml`, so this never names one.
 */
const RETIRED_SHARD = /^[a-z]+_[a-z]{2}_[0-9a-f]{3}\.xml$/u;

/**
 * Whether one address is gone for good: a page of a retired family, an asset of
 * the retired framework, or a retired sitemap shard. The server entry answers it
 * 410 Gone, so a crawler drops it faster than it drops a 404, and asks this after
 * the migrations and the moved addresses, so an address with a successor still
 * moves there in one hop.
 */
export function isGoneAddress(pathname: string) {
  const segments = readPathSegments(pathname);
  const [first, second] = segments;
  if (first === RETIRED_ASSETS) {
    return true;
  }
  if (first === SITEMAP_FOLDER) {
    return (
      segments.length === 2 &&
      RETIRED_SHARD.test(Arr.join(Arr.drop(segments, 1), "/"))
    );
  }
  const family = Schema.is(LocaleSchema)(first) ? second : first;
  return family !== undefined && HashSet.has(GONE_FAMILIES, family);
}

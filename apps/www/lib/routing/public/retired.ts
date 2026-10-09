import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Effect, HashSet, Option, Schema } from "effect";
import { readPublishedTryoutExamPage } from "@/lib/content/tryout/catalog";
import { readRetiredSnbtProduct } from "@/lib/routing/public/tryout/product";
import {
  readPathSegments,
  SNBT_EXAM_PATH,
  SOURCE_APP_LOCALE,
} from "@/lib/routing/public/tryout/route";

const decodeAppLocale = Schema.decodeUnknownOption(AppLocaleCodeSchema);
const RetiredPublicRouteInputSchema = Schema.Struct({
  hasAttemptCapability: Schema.Boolean,
  pathname: Schema.String,
});
/** Removed feature routes and files that have no successor, matched as whole pathnames. */
const REMOVED_PATHNAMES = HashSet.make(
  "/api/chat/finance",
  "/sitemap-domain.xml"
);

/** Reads whether the segments after an app locale name a removed feature route. */
function isRemovedLocalizedRoute(segments: readonly string[]) {
  const [first, second] = segments;
  if (first === "events") {
    return segments.length === 1;
  }
  if (first === "finance") {
    return (
      segments.length === 1 || (segments.length === 3 && second === "chat")
    );
  }
  if (first === "event") {
    return segments.length === 3 && second === "try-out";
  }
  return false;
}

/** Reads whether one pathname is a removed feature route or file. */
function isRemovedPathname(pathname: string) {
  if (HashSet.has(REMOVED_PATHNAMES, pathname)) {
    return true;
  }
  const [localeSegment, ...rest] = readPathSegments(pathname);
  return (
    Option.isSome(decodeAppLocale(localeSegment)) &&
    isRemovedLocalizedRoute(rest)
  );
}

/**
 * SNBT years whose track was retired, so their product URLs answer gone while
 * the signed exam has no track for them. A year is added only when its track is
 * retired: a year that is not published yet stays a plain 404 and can still
 * redirect once it is published.
 */
const RETIRED_SNBT_YEARS = HashSet.make("2026");

/**
 * Reads whether one retired SNBT year has no track in the signed exam. Only a
 * year in RETIRED_SNBT_YEARS can answer gone, and an absent exam proves nothing
 * about a year, so it never answers gone.
 */
const readRetiredSnbtYear = Effect.fn("www.routing.publicHtml.retiredSnbtYear")(
  function* (year: string) {
    if (!HashSet.has(RETIRED_SNBT_YEARS, year)) {
      return false;
    }
    const exam = yield* readPublishedTryoutExamPage({
      appLocale: SOURCE_APP_LOCALE,
      publicPath: SNBT_EXAM_PATH,
    });
    if (exam === null) {
      return false;
    }
    return !Arr.some(
      exam.tracks,
      (track) => track.trackKind === "year" && track.trackKey === year
    );
  }
);

/**
 * Answers whether one public URL is gone for good: a removed feature route or
 * file, or a product URL of a retired SNBT year that the signed exam has no
 * track for. Try-out attempts skip the try-out answer, as they skip the try-out
 * redirects.
 */
export const readRetiredPublicRoute = Effect.fn(
  "www.routing.publicHtml.retiredRoute"
)(function* (input: typeof RetiredPublicRouteInputSchema.Type) {
  if (isRemovedPathname(input.pathname)) {
    return true;
  }
  if (input.hasAttemptCapability) {
    return false;
  }
  const product = readRetiredSnbtProduct(input.pathname);
  if (Option.isNone(product)) {
    return false;
  }
  return yield* readRetiredSnbtYear(product.value.year);
});

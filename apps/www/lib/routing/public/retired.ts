import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Effect, HashSet, Option, Schema } from "effect";
import { readPublishedTryoutExamPage } from "@/lib/content/tryout/page";
import {
  readRetiredSnbtProduct,
  SNBT_EXAM_PATH,
  SOURCE_APP_LOCALE,
} from "@/lib/routing/public/tryout";

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

/** Splits one public pathname into its non-empty segments. */
function readPathSegments(pathname: string) {
  return Arr.filter(pathname.split("/"), (segment) => segment !== "");
}

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
 * Reads whether the signed catalog serves the SNBT exam without a track for one
 * year. An absent exam proves nothing about a year, so it never answers gone.
 */
const readRetiredSnbtYear = Effect.fn("www.routing.publicHtml.retiredSnbtYear")(
  function* (year: string) {
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
 * file, or a retired SNBT product URL whose year has no live track. Try-out
 * attempts skip the try-out answer, as they skip the try-out redirects.
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

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

/** Reads whether one pathname is the removed events page of an app locale. */
function isRemovedPathname(pathname: string) {
  const [localeSegment, ...rest] = readPathSegments(pathname);
  return (
    Option.isSome(decodeAppLocale(localeSegment)) &&
    rest.length === 1 &&
    rest[0] === "events"
  );
}

/**
 * SNBT years that were retired, so their product URLs answer gone while the
 * signed exam has no group for them. A year is added only when its track is
 * retired: a year that is not published yet stays a plain 404 and can still
 * redirect once it is published.
 */
const RETIRED_SNBT_YEARS = HashSet.make("2026");

/**
 * Reads whether one retired SNBT year has no group in the signed exam. Only a
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
    return !Arr.some(exam.groups, (group) => group.groupKey === year);
  }
);

/**
 * Answers whether one public URL is gone for good: the removed events page, or
 * a product URL of a retired SNBT year that the signed exam has no group for.
 * Try-out attempts skip the try-out answer, as they skip the try-out redirects.
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

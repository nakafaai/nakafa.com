import { TRACK_SET_PAGE_LIMIT } from "@repo/backend/confect/tryouts/sets/query";
import { LocaleSchema } from "@repo/internationalization/src/locale";
import { Array as Arr, Effect, Schema } from "effect";
import { CatalogQuery } from "@/components/tryout/catalog/table/query";
import { TRYOUT_SET_PAGE_SIZE } from "@/components/tryout/catalog/table/types";
import { PRACTICE_SEARCH } from "@/components/tryout/route/path";
import { QueryText } from "@/lib/routing/search";

/** The keys of one track that its set list is read for. */
const TrackKeysSchema = Schema.Struct({
  countryKey: Schema.String,
  examKey: Schema.String,
  trackKey: Schema.String,
});

/**
 * The set list request of one track: its locale, its catalog query, its keys and
 * the number of rows to read. A visitor grows that number by loading more, and the
 * loader omits it for the first page.
 */
export const TrackListRequestSchema = Schema.Struct({
  locale: LocaleSchema,
  numItems: Schema.optionalKey(
    Schema.Int.check(
      Schema.isBetween({
        maximum: TRACK_SET_PAGE_LIMIT,
        minimum: TRYOUT_SET_PAGE_SIZE,
      })
    )
  ),
  search: CatalogQuery,
  track: TrackKeysSchema,
});

/**
 * One query value of an attempt page: its text, or the text of each repeated
 * value. A value of any other shape reads as empty, which the readers refuse as
 * invalid, so the page answers not found.
 */
const TryoutQueryValue = Schema.Union([
  QueryText,
  Schema.Array(QueryText),
]).pipe(Schema.catchDecoding(() => Effect.succeedSome("")));

/**
 * The question the player is on, as the router parsed it from the address: a whole number from 1, which the router
 * writes back as the same digits. Kept as text it would come back quoted (`"12"`), which names no question. Any other
 * value names none, so the key goes and the player opens the first question.
 */
const TryoutQuestionNumber = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(1)
).pipe(Schema.catchDecoding(() => Effect.succeedNone));

/**
 * The address of an attempt page: its attempt capability, its player view, and
 * the question the player is on. The first two stay raw here, because a page
 * refuses an invalid value with not found, as the attempt readers decide it.
 */
export const TryoutAttemptSearch = Schema.Struct({
  attemptId: Schema.optionalKey(TryoutQueryValue),
  /** `practice` opens the page's practice in place of its try-out (ADR 0044). */
  mode: Schema.optionalKey(TryoutQueryValue),
  question: Schema.optionalKey(TryoutQuestionNumber),
  view: Schema.optionalKey(TryoutQueryValue),
});

export type TryoutAttemptSearch = typeof TryoutAttemptSearch.Type;

/**
 * Whether a set's address opens one of its papers, which take the whole page: its practice, or, for a set entered by
 * its one section, the attempt the address names, its player while it runs and its review once it ends, as a
 * section's own page does. Any other address of a set opens its pane beside its track's table.
 */
export function opensSetPaper(
  search: Pick<TryoutAttemptSearch, "attemptId" | "mode">,
  entered: boolean
) {
  return (
    search.mode === PRACTICE_SEARCH.mode ||
    (entered && search.attemptId !== undefined)
  );
}

/**
 * The mark the script below sets on itself, before the first paint, when a set's address opens one of its papers. The
 * server never writes it, so a page the client renders, or an address that opens no paper, carries none.
 */
export const SET_PAPER_ATTRIBUTE = "data-set-paper";

/**
 * The inline script that decides, before the first paint, whether a set's address opens one of its papers, as
 * `opensSetPaper` decides it for the page. The build prerenders the set's bare address, its pane beside its track's
 * table, and every address of the set serves that page, so the page hydrates as the bare address and draws the paper
 * once it has. The script marks itself while the browser reads the markup, and the track hides the table it stands
 * beside until then, so a paper's address never paints the table first.
 */
export function setPaperScript(entered: boolean) {
  return Arr.join(
    [
      "(function () {",
      "  var search = new URLSearchParams(location.search);",
      "  var mode = search.getAll('mode');",
      `  var practice = mode.length === 1 && mode[0] === '${PRACTICE_SEARCH.mode}';`,
      `  if (practice || (${String(entered)} && search.has('attemptId'))) {`,
      `    document.currentScript.setAttribute('${SET_PAPER_ATTRIBUTE}', '');`,
      "  }",
      "})();",
    ],
    "\n"
  );
}

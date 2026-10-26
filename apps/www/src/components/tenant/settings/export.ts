import journal from "@repo/backend/confect/_generated/refs/journal";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, DateTime, Effect, Option, Stream, Tuple } from "effect";
import { readOnce } from "@/lib/convex/read";

/** How many entries each read of the export takes. */
const EXPORT_PAGE = 200;

/** A cell that a spreadsheet would run as a formula starts with one of these (OWASP, CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

/** The mark that tells a spreadsheet the file is UTF-8. */
const BYTE_ORDER_MARK = "\uFEFF";

/** A cell that holds a comma, a quote or a line break is quoted (RFC 4180). */
const NEEDS_QUOTES = /[",\r\n]/;

/**
 * Reads the school's whole audit trail, newest first, one page per Convex read on the browser's
 * client, until the journal says it is done.
 */
export const readAuditTrail = Effect.fn("tenant.audit.readTrail")(
  (slug: TenantSlug) =>
    Stream.paginate(Option.none<string>(), (cursor) =>
      readOnce(journal.audit.list, {
        paginationOpts: {
          cursor: Option.getOrNull(cursor),
          numItems: EXPORT_PAGE,
        },
        slug,
      }).pipe(
        Effect.map((result) =>
          Tuple.make(
            result.page,
            result.isDone
              ? Option.none()
              : Option.some(Option.some(result.continueCursor))
          )
        )
      )
    ).pipe(Stream.runCollect)
);

/** One cell as CSV text: a formula start is kept as text by an apostrophe, and a separator is quoted. */
const csvCell = (value: string) => {
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/**
 * The rows as CSV text: a byte order mark first, so a spreadsheet reads the names as UTF-8, and
 * every row ended by CRLF (RFC 4180).
 */
export const csvText = (rows: readonly (readonly string[])[]) =>
  `${BYTE_ORDER_MARK}${Arr.join(
    Arr.map(rows, (row) => `${Arr.join(Arr.map(row, csvCell), ",")}\r\n`),
    ""
  )}`;

/** When an entry happened, as an ISO 8601 time in UTC that every spreadsheet and inspector reads alike. */
export const entryTime = (at: number) =>
  DateTime.formatIso(DateTime.makeUnsafe(at));

/** The export's file name: the school and the day it was taken, as `audit-harapan-2026-10-26.csv`. */
export const auditFileName = Effect.fn("tenant.audit.fileName")(function* (
  slug: TenantSlug
) {
  const now = yield* DateTime.now;
  return `audit-${slug}-${DateTime.formatIsoDateUtc(now)}.csv`;
});

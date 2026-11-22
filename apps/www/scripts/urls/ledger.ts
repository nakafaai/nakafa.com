import { Array as Arr, Option, Order } from "effect";

/**
 * The ledger of published addresses: every path that Nakafa has served as a
 * page, one per line, sorted and unique. A path never leaves it, so a page that
 * goes away must keep answering 200, a redirect to a page, or 410 Gone.
 */

/** The paths of a ledger's text, without blank lines. */
export function readLedger(text: string): readonly string[] {
  return Arr.filter(
    Arr.map(text.split("\n"), (line) => line.trim()),
    (line) => line !== ""
  );
}

/** The text of a ledger that holds every given path once, sorted. */
export function writeLedger(paths: Iterable<string>): string {
  const sorted = Arr.sort(Arr.dedupe(Arr.fromIterable(paths)), Order.String);
  return Arr.isReadonlyArrayNonEmpty(sorted)
    ? `${Arr.join(sorted, "\n")}\n`
    : "";
}

/**
 * The path that a location names on the site, or none for a location on another
 * origin. The query and the fragment do not name another page, so both go.
 */
export function toLedgerPath(
  location: string,
  origin: string
): Option.Option<string> {
  const url = new URL(location, origin);
  return url.origin === new URL(origin).origin
    ? Option.some(url.pathname)
    : Option.none();
}

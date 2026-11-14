import type { ParsedHeading } from "@repo/contents/toc";
import { Array as Arr, Option, Schema } from "effect";

/**
 * Where one heading of the outline stands in the reader's frame: its top edge
 * from the top of the viewport, and the reading line it passes when its section
 * starts being read.
 */
const HeadingPlace = Schema.Struct({
  id: Schema.String,
  line: Schema.Finite,
  top: Schema.Finite,
});

/** The viewport a reading is measured in. */
const ReadingView = Schema.Struct({
  /** Whether the page is scrolled to its end, where nothing moves further. */
  atEnd: Schema.Boolean,
  height: Schema.Finite,
});

/**
 * The id of each heading the outline links to, in the order the page draws them.
 * An entry's link is the one source of its heading's id.
 */
export function outlineIds(outline: readonly ParsedHeading[]): string[] {
  return Arr.flatMap(outline, (heading) => [
    heading.href.slice(1),
    ...outlineIds(heading.children),
  ]);
}

/**
 * The heading of the section being read: the last heading, in the order the page
 * draws them, whose top has passed its reading line. At the end of the page the
 * reader cannot bring a later heading up to the line, so the last heading on
 * screen is read. Above the first heading no section is.
 */
export function readingHeading(
  places: readonly (typeof HeadingPlace.Type)[],
  view: typeof ReadingView.Type
): Option.Option<string> {
  return Arr.findLast(places, (place) =>
    view.atEnd ? place.top < view.height : place.top <= place.line
  ).pipe(Option.map((place) => place.id));
}

/** One box along the vertical axis, by its top and bottom edges. */
const Span = Schema.Struct({
  bottom: Schema.Finite,
  top: Schema.Finite,
});

/**
 * How far a scroller moves so that an entry stands wholly inside it: the least
 * move, up when the entry starts above the scroller and down when it ends below
 * it, and none when the entry is already inside.
 */
export function revealOffset(
  entry: typeof Span.Type,
  scroller: typeof Span.Type
): number {
  if (entry.top < scroller.top) {
    return entry.top - scroller.top;
  }
  if (entry.bottom > scroller.bottom) {
    return Math.min(entry.bottom - scroller.bottom, entry.top - scroller.top);
  }
  return 0;
}

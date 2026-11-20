import {
  arrivalOf,
  placeAt,
  type Stage,
} from "@repo/design-system/components/contents/mathematics/journey/trip";
import { Array as Arr, Option, Order, Schema } from "effect";

/** Where two travellers meet: the minute, and their distance from the start then. */
const MeetingSchema = Schema.Struct({
  distance: Schema.Finite,
  minute: Schema.Finite,
});
type Meeting = typeof MeetingSchema.Type;

/** How close two distances may be, in kilometres, and still count as one place. */
const SAME = 1e-9;

/**
 * The first moment after both travellers have left at which they stand at the
 * same distance from the start, which on the graph is where their lines first
 * cross or touch. Both lines are straight between the ends of their legs, so
 * between two such ends the gap between them changes steadily, and it crosses
 * zero at most once. A meeting at the moment the later one leaves does not
 * count, as two travellers who set off together have not met; neither does
 * one after either has arrived.
 */
export function meetingOf(
  first: Arr.NonEmptyReadonlyArray<Stage>,
  second: Arr.NonEmptyReadonlyArray<Stage>
): Option.Option<Meeting> {
  const opens = Math.max(
    Arr.headNonEmpty(first).start,
    Arr.headNonEmpty(second).start
  );
  const closes = Math.min(arrivalOf(first), arrivalOf(second));
  if (closes <= opens) {
    return Option.none();
  }
  const gap = (minute: number) =>
    placeAt(first, minute) - placeAt(second, minute);
  const ends = Arr.flatMap([...first, ...second], (stage) => [
    stage.start,
    stage.end,
  ]);
  const moments = Arr.sort(
    Arr.dedupe([
      opens,
      closes,
      ...Arr.filter(ends, (minute) => minute > opens && minute < closes),
    ]),
    Order.Number
  );
  const crossing = Arr.findFirst(Arr.drop(moments, 1), (to, index) => {
    const from = Arr.getUnsafe(moments, index);
    const before = gap(from);
    const after = gap(to);
    if (Math.abs(after) < SAME) {
      return Option.some(to);
    }
    return before * after < 0
      ? Option.some(from + ((to - from) * before) / (before - after))
      : Option.none();
  });
  return Option.map(crossing, (minute) => ({
    distance: placeAt(first, minute),
    minute,
  }));
}

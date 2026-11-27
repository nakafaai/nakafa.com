import type { Stage } from "@repo/design-system/components/contents/mathematics/journey/trip";
import {
  arrivalOf,
  placeAt,
} from "@repo/design-system/components/contents/mathematics/journey/trip";
import { Array as Arr, Order, Schema } from "effect";

/**
 * The lines of the distance-time graph under the scene: a traveller's whole
 * route as the corners of its line, the part of it already travelled, and on
 * which side of a corner its letter is written.
 */

/** A point of the graph: a distance from the start at a minute of the clock. */
const MarkSchema = Schema.Struct({ km: Schema.Finite, minute: Schema.Finite });
export type Mark = typeof MarkSchema.Type;

/** The side of a corner its letter is written on. */
const SideSchema = Schema.Literals(["top", "right", "left", "bottom"]);
export type Side = typeof SideSchema.Type;

/** The corners of a traveller's line: where it starts, then the end of every leg. */
export function routeOf(
  stages: Arr.NonEmptyReadonlyArray<Stage>
): Arr.NonEmptyReadonlyArray<Mark> {
  const first = Arr.headNonEmpty(stages);
  return [
    { km: first.from, minute: first.start },
    ...Arr.map(stages, (stage) => ({ km: stage.to, minute: stage.end })),
  ];
}

/**
 * The part of a traveller's line drawn by `minute`: the corners it has
 * passed, then where it is now. Before it leaves it has drawn nothing, and
 * once it arrives its line is whole.
 */
export function travelledOf(
  stages: Arr.NonEmptyReadonlyArray<Stage>,
  minute: number
): readonly Mark[] {
  if (minute < Arr.headNonEmpty(stages).start) {
    return [];
  }
  const now = Math.min(minute, arrivalOf(stages));
  return [
    ...Arr.filter(routeOf(stages), (mark) => mark.minute < now),
    { km: placeAt(stages, now), minute: now },
  ];
}

/** A side a letter may take, as a step on the page: across to the right and up. */
const TOP = { across: 0, side: "top", up: 1 } as const;
const RIGHT = { across: 1, side: "right", up: 0 } as const;
const LEFT = { across: -1, side: "left", up: 0 } as const;
const BOTTOM = { across: 0, side: "bottom", up: -1 } as const;

/**
 * On which side of the corner `here` its letter is written, on a graph whose
 * axes reach `tops` and that is drawn `shape` times as wide as tall: the side
 * that points farthest from the lines that meet at the corner, so the letter
 * never lies on the line. A corner on the time axis never takes the side
 * below it, nor one on the distance axis the side to its left, where the
 * axes' numbers are.
 */
export function letterSide(
  here: Mark,
  neighbours: readonly Mark[],
  tops: Mark,
  shape: number
): Side {
  const lines = Arr.map(neighbours, (mark) => {
    const across = ((mark.minute - here.minute) / tops.minute) * shape;
    const up = (mark.km - here.km) / tops.km;
    const length = Math.hypot(across, up);
    return { across: across / length, up: up / length };
  });
  const free = Arr.make(
    TOP,
    RIGHT,
    ...(here.minute > 0 ? [LEFT] : []),
    ...(here.km > 0 ? [BOTTOM] : [])
  );
  const nearest = (each: (typeof free)[number]) =>
    Math.max(
      -1,
      ...Arr.map(lines, (line) => each.across * line.across + each.up * line.up)
    );
  return Arr.headNonEmpty(Arr.sort(free, Order.mapInput(Order.Number, nearest)))
    .side;
}

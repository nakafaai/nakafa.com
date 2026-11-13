import { Array as Arr, Schema } from "effect";

/**
 * Car trips along a straight road, each a chain of stretches of constant
 * acceleration, in metres and seconds. A trip gives the position and the
 * velocity at every moment, and the average velocity over any interval is
 * the slope of the secant between its two points on the position-time graph.
 */

/** The trips a lesson can show. */
export const TripSchema = Schema.Literals(["commute", "cruise", "return"]);
export type Trip = typeof TripSchema.Type;

const StretchSchema = Schema.Struct({
  acceleration: Schema.Finite,
  duration: Schema.Finite,
});
type Stretch = typeof StretchSchema.Type;

/**
 * commute: speeds up, cruises, brakes to a red light, waits, and drives on,
 * 110 m in 20 s. cruise: a steady 8 m/s for 10 s. return: thrown out at
 * 6 m/s and braked at 1.2 m/s² until it rolls back to the start at 10 s.
 */
const TRIPS = {
  commute: {
    intervals: [
      [0, 4],
      [4, 10],
      [10, 16],
      [0, 20],
    ],
    start: 0,
    stretches: [
      { acceleration: 2.5, duration: 4 },
      { acceleration: 0, duration: 6 },
      { acceleration: -5, duration: 2 },
      { acceleration: 0, duration: 4 },
      { acceleration: 2.5, duration: 4 },
    ],
  },
  cruise: {
    intervals: [
      [0, 2],
      [2, 6],
      [4, 10],
      [0, 10],
    ],
    start: 8,
    stretches: [{ acceleration: 0, duration: 10 }],
  },
  return: {
    intervals: [
      [0, 5],
      [5, 10],
      [2, 8],
      [0, 10],
    ],
    start: 6,
    stretches: [{ acceleration: -1.2, duration: 10 }],
  },
} as const satisfies Record<
  Trip,
  {
    intervals: readonly (readonly [number, number])[];
    start: number;
    stretches: readonly Stretch[];
  }
>;

/** The position and velocity of a trip at `time`, held at the trip's end after it. */
export function tripState(trip: Trip, time: number) {
  let position = 0;
  let velocity: number = TRIPS[trip].start;
  let left = Math.max(time, 0);
  for (const stretch of TRIPS[trip].stretches) {
    const used = Math.min(left, stretch.duration);
    position += velocity * used + 0.5 * stretch.acceleration * used * used;
    velocity += stretch.acceleration * used;
    left -= used;
  }
  return { position, velocity };
}

/** How long a trip lasts, in seconds. */
export function tripDuration(trip: Trip) {
  const stretches: readonly Stretch[] = TRIPS[trip].stretches;
  return Arr.reduce(
    stretches,
    0,
    (sum, stretch) => sum + stretch.duration
  );
}

/** The intervals a learner can choose, as start and end times in seconds. */
export function tripIntervals(trip: Trip) {
  return TRIPS[trip].intervals;
}

/** The change of position, the time, and the average velocity over one interval. */
export function averageOver(
  trip: Trip,
  [start, end]: readonly [number, number]
) {
  const displacement =
    tripState(trip, end).position - tripState(trip, start).position;
  const elapsed = end - start;
  return { displacement, elapsed, velocity: displacement / elapsed };
}

/** The graphs a trip can draw: position against time, or velocity against time. */
export const TripGraphSchema = Schema.Literals(["position", "velocity"]);
export type TripGraph = typeof TripGraphSchema.Type;

/** The quantity a graph plots at `time`. */
export function tripValue(trip: Trip, graph: TripGraph, time: number) {
  const state = tripState(trip, time);
  return graph === "position" ? state.position : state.velocity;
}

/**
 * The change of the plotted quantity over one interval and its rate: the
 * displacement and average velocity on a position graph, the change of
 * velocity and average acceleration on a velocity graph. Either way it is
 * the slope of the secant between the interval's two points.
 */
export function changeOver(
  trip: Trip,
  graph: TripGraph,
  [start, end]: readonly [number, number]
) {
  const change = tripValue(trip, graph, end) - tripValue(trip, graph, start);
  return { change, elapsed: end - start, rate: change / (end - start) };
}

/** The lowest and highest values a graph of the trip reaches, for its range. */
export function tripReach(trip: Trip, graph: TripGraph = "position") {
  const samples = Arr.makeBy(201, (index) =>
    tripValue(trip, graph, (tripDuration(trip) * index) / 200)
  );
  return { highest: Math.max(...samples), lowest: Math.min(...samples) };
}

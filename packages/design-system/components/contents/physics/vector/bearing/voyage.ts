import { Array as Arr, Schema } from "effect";

/**
 * A voyage from a harbour in straight legs, each a distance on a bearing:
 * degrees clockwise from north, as a ship's compass reads. Measured from
 * the north axis, a leg's north component takes the cosine and its east
 * component the sine. The legs add by components into the displacement
 * from the harbour.
 */

/** One leg: its distance in kilometres and its bearing in degrees. */
const CourseSchema = Schema.Struct({
  bearing: Schema.Finite,
  distance: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
});
export type Course = typeof CourseSchema.Type;

/** A voyage: its legs in order. */
export const CoursesSchema = Schema.NonEmptyArray(CourseSchema);

/** One leg as components east and north, in kilometres. */
export function courseParts(course: Course) {
  const turn = (course.bearing * Math.PI) / 180;
  return {
    east: course.distance * Math.sin(turn),
    north: course.distance * Math.cos(turn),
  };
}

/** The corners of the voyage from the harbour, in kilometres east and north. */
export function voyageCorners(courses: readonly Course[]) {
  return Arr.scan(courses, { east: 0, north: 0 }, (at, course) => {
    const parts = courseParts(course);
    return { east: at.east + parts.east, north: at.north + parts.north };
  });
}

/**
 * The displacement from the harbour: its components, its size, its bearing
 * in [0, 360), and the length of the path sailed, in kilometres.
 */
export function voyageDisplacement(courses: readonly Course[]) {
  const east = Arr.reduce(
    courses,
    0,
    (sum, course) => sum + courseParts(course).east
  );
  const north = Arr.reduce(
    courses,
    0,
    (sum, course) => sum + courseParts(course).north
  );
  const size = Math.hypot(east, north);
  return {
    bearing:
      size < 1e-9 ? 0 : ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360,
    east,
    north,
    path: Arr.reduce(courses, 0, (sum, course) => sum + course.distance),
    size,
  };
}

/** Where the ship is after sailing `distance` kilometres along the voyage; past the end it lies at the last corner. */
export function voyagePoint(
  courses: readonly [Course, ...Course[]],
  distance: number
) {
  const corners = voyageCorners(courses);
  let left = Math.max(distance, 0);
  let index = 0;
  while (index < courses.length - 1 && left > courses[index].distance) {
    left -= courses[index].distance;
    index += 1;
  }
  const course = courses[index];
  const start = corners[index];
  const parts = courseParts(course);
  const part = Math.min(left / course.distance, 1);
  return {
    east: start.east + parts.east * part,
    north: start.north + parts.north * part,
  };
}

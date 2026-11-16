import { Array as Arr, Option } from "effect";
import { Vector3 } from "three";

/** The radius of the Earth in the scene, in scene units. */
export const EARTH_RADIUS = 0.94;

/** Where the camera stands and what it looks at when the lab opens. */
export const CAMERA = {
  position: [3, 1.7, 4.05],
  target: [0.1, 0.08, 0],
} as const;

/**
 * Where the Sun stands, up and to the left of the Earth as the camera sees
 * it and a little toward the camera, so the sunlit side faces the reader.
 */
export const SUN = { position: [-1.2, 1.46, 0.74], radius: 0.2 } as const;

/**
 * The screen angle of each infrared ray as the camera sees it, in degrees from its
 * right, kept away from the upper left where the sunlight arrives.
 */
const RAY_ANGLES = [-160, -117, -73, -30, 13, 50, 85];

/** How far each ray leans toward the camera, so it leaves the visible face. */
const RAY_TILT = 0.3;

/** The order in which rays meet a molecule as the gas level rises. */
const ABSORPTION_ORDER = [2, 5, 0, 4, 1, 6, 3];

/** How far out an escaping ray is drawn before it fades into space. */
const ESCAPE_RADIUS = 1.8;

/** How far a ray sent outward again travels before it fades. */
const REEMISSION_REACH = 0.6;

/** The turn of a ray sent back down from the way it came, in degrees. */
const RETURN_TURN = 38;

/** The turn of a ray sent outward again from the way it came, in degrees. */
const OUTWARD_TURN = 70;

/** How far the parallel sunbeams sit from the line to the Earth's centre. */
const BEAM_OFFSETS = [-0.42, -0.14, 0.14, 0.42];

/** How much the beams narrow toward the Sun, so they leave its disc. */
const BEAM_NARROWING = 0.35;

/** The wavelength and height of an infrared ribbon's wave, in scene units. */
const WAVELENGTH = 0.11;
const AMPLITUDE = 0.034;

/** How far the wave takes to rise from each end of its segment. */
const TAPER = 0.07;

/** Sample points per wavelength of a ribbon. */
const SAMPLES_PER_WAVE = 14;

const vector = (point: readonly [number, number, number]) =>
  new Vector3(point[0], point[1], point[2]);

const triple = (point: Vector3) => [point.x, point.y, point.z] as const;

/** The direction the camera looks back along, from the Earth toward it. */
const toward = () => vector(CAMERA.position).normalize();

/**
 * Where `point` falls on the plane the camera sees face on, through the
 * Earth's centre: what lies one behind the other there looks as if it meets.
 */
export function onScreen(point: readonly [number, number, number]) {
  const view = toward();
  const place = vector(point);
  return triple(place.addScaledVector(view, -place.dot(view)));
}

/** Whether the Earth hides `point` from the camera where the lab opens. */
export function hidden(point: readonly [number, number, number]) {
  const place = vector(point);
  return (
    place.dot(toward()) < 0 && vector(onScreen(point)).length() < EARTH_RADIUS
  );
}

/** The camera's right and up as unit vectors in the scene. */
function screen() {
  const view = toward();
  const right = new Vector3(0, 1, 0).cross(view).normalize();
  const up = view.clone().cross(right);
  return { right, up, view };
}

/** The unit direction a ray at screen angle `degrees` leaves the surface along. */
function rayDirection(degrees: number) {
  const { right, up, view } = screen();
  const angle = (degrees * Math.PI) / 180;
  return right
    .multiplyScalar(Math.cos(angle))
    .add(up.multiplyScalar(Math.sin(angle)))
    .add(view.multiplyScalar(RAY_TILT))
    .normalize();
}

/** How far out the molecule that stops each ray sits, two heights in turn. */
const absorberRadius = (index: number) => (index % 2 === 0 ? 1.22 : 1.3);

/**
 * Where a ray from `origin` along the unit `direction` meets the surface,
 * when it does, by the nearer root of |origin + t direction| = R.
 */
function surfaceHit(origin: Vector3, direction: Vector3) {
  const b = origin.dot(direction);
  const disc = b * b - (origin.lengthSq() - EARTH_RADIUS * EARTH_RADIUS);
  const t = -b - Math.sqrt(Math.max(disc, 0));
  // The ray meets the sphere only with a real root that lies ahead of it.
  if (Math.min(disc, t) <= 0) {
    return Option.none();
  }
  return Option.some(origin.clone().addScaledVector(direction, t));
}

/** A straight stretch of a path, with how far the path ran before it. */
function segment(start: Vector3, end: Vector3, offset: number, fades: boolean) {
  return {
    end: triple(end),
    fades,
    length: start.distanceTo(end),
    offset,
    start: triple(start),
  };
}

/**
 * The path of ray `index`, at screen angle `degrees`, when a molecule stops it: up to the molecule, then
 * off in a new direction, back down to the surface or outward again.
 */
function absorbedPath(index: number, degrees: number, order: number) {
  const direction = rayDirection(degrees);
  const launch = direction.clone().multiplyScalar(EARTH_RADIUS);
  const absorber = direction.clone().multiplyScalar(absorberRadius(index));
  const outward = order % 3 === 2;
  const side = index % 2 === 0 ? 1 : -1;
  const turn = ((outward ? OUTWARD_TURN : RETURN_TURN) * side * Math.PI) / 180;
  const heading = (outward ? direction.clone() : direction.clone().negate())
    .applyAxisAngle(toward(), turn)
    .normalize();
  const hit = surfaceHit(absorber, heading);
  const end = Option.match(hit, {
    onNone: () => absorber.clone().addScaledVector(heading, REEMISSION_REACH),
    onSome: (point) => point,
  });
  const climb = absorber.distanceTo(launch);
  return {
    absorber: Option.some(triple(absorber)),
    segments: [
      segment(launch, absorber, 0, false),
      segment(absorber, end, climb, Option.isNone(hit)),
    ],
  };
}

/** The path of a ray at screen angle `degrees` when nothing stops it. */
function escapedPath(degrees: number) {
  const direction = rayDirection(degrees);
  return {
    absorber: Option.none<readonly [number, number, number]>(),
    segments: [
      segment(
        direction.clone().multiplyScalar(EARTH_RADIUS),
        direction.clone().multiplyScalar(ESCAPE_RADIUS),
        0,
        true
      ),
    ],
  };
}

/**
 * How many of the rays meet a molecule at gas level `level`, from 1 to 5:
 * about one in six for each level, so 1, 2, 4, 5 and 6 of the seven.
 */
function absorbedCount(level: number) {
  return Math.round((RAY_ANGLES.length * level) / 6);
}

/**
 * The infrared rays leaving the surface at gas level `level`. A ray either
 * escapes to space or meets a molecule, which sends it on in a new direction;
 * more gas stops more rays, always adding to those it already stopped.
 */
export function infraredRays(level: number) {
  const stopped = Arr.take(ABSORPTION_ORDER, absorbedCount(level));
  return Arr.map(RAY_ANGLES, (degrees, index) => {
    const order = Arr.findFirstIndex(stopped, (ray) => ray === index);
    const path = Option.match(order, {
      onNone: () => escapedPath(degrees),
      onSome: (position) => absorbedPath(index, degrees, position),
    });
    return { id: `ray-${index}`, ...path };
  });
}

/**
 * Every stretch any infrared ray could take at any level, every molecule that
 * could stop one, and the sunbeams, which the other molecules keep clear of.
 */
export function rayClearance() {
  const paths = Arr.flatMap(RAY_ANGLES, (degrees, index) => [
    escapedPath(degrees),
    absorbedPath(index, degrees, 0),
    absorbedPath(index, degrees, 2),
  ]);
  return {
    absorbers: Arr.getSomes(Arr.map(paths, (path) => path.absorber)),
    beams: sunBeams(),
    segments: Arr.flatMap(paths, (path) => path.segments),
  };
}

/**
 * The sunbeams: parallel rays from the Sun's direction that end where they
 * strike the surface, drawn from its disc so they read as its light.
 */
export function sunBeams() {
  const sun = vector(SUN.position);
  const travel = sun.clone().negate().normalize();
  const across = travel.clone().cross(toward()).normalize();
  return Arr.map(BEAM_OFFSETS, (offset) => {
    const line = sun.clone().addScaledVector(across, offset);
    const reach =
      -line.dot(travel) -
      Math.sqrt(EARTH_RADIUS * EARTH_RADIUS - offset * offset);
    const end = line.addScaledVector(travel, reach);
    const start = sun
      .clone()
      .addScaledVector(across, offset * BEAM_NARROWING)
      .addScaledVector(end.clone().sub(sun).normalize(), SUN.radius * 1.05);
    return segment(start, end, 0, false);
  });
}

/**
 * The points of an infrared ribbon along `stretch`: a sine wave across it,
 * in the plane the camera sees face on, that rises from nothing at each end
 * so the ribbon meets the surface and the molecules cleanly.
 */
export function wavePoints(stretch: ReturnType<typeof segment>) {
  const start = vector(stretch.start);
  const run = vector(stretch.end).sub(start);
  const length = run.length();
  const across = run.clone().cross(toward()).normalize();
  const count = Math.max(
    8,
    Math.ceil((length / WAVELENGTH) * SAMPLES_PER_WAVE)
  );
  return Arr.map(Arr.range(0, count), (step) => {
    const share = step / count;
    const distance = share * length;
    const rise = Math.min(1, distance / TAPER, (length - distance) / TAPER);
    const height =
      AMPLITUDE * rise * Math.sin((2 * Math.PI * distance) / WAVELENGTH);
    return triple(
      start.clone().addScaledVector(run, share).addScaledVector(across, height)
    );
  });
}

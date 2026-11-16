import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr } from "effect";
import type { Weather } from "@/lib/island/sky";
import { TILE } from "@/lib/island/tiles/paint";

/**
 * The island's one wind (ADR 0047, D32). Everything that the wind moves reads
 * it from here: the leaves and the crops, each tree's lean, the streak a gust
 * draws over the grass. So a gust crosses the island as one front, and what
 * stands in still air stands still.
 */

/** Seconds after which the gusts come round again. */
export const WIND_CYCLE = 24;

/** The way the wind blows over the ground, as a unit step (x, z): from the west, a little toward the south. */
export const WIND_HEADING = [0.97, 0.243] as const;

/** Seconds one flutter of a leaf takes, and the cells between two crests of the flutter along the wind. */
const WIND_BEAT = 1.6;
const WIND_WAVE = 4.5;

/** How often the leaves take a new pose, a second: a pixel's worth of motion drawn on twos, never a slide. */
const WIND_POSES = 10;

/** The side of the lean map in texels, and the square of the world it covers: its side in cells and the coordinate it starts at, with the learner's island in its middle and every isle of the ring inside it. */
export const WIND_SIDE = 64;
export const WIND_SPAN = 256;
export const WIND_FROM = SPAN / 2 - WIND_SPAN / 2;

/** The most a treetop leans, in art pixels: the lean one byte of the map spans, from -WIND_LEAN to WIND_LEAN. */
const WIND_LEAN = 4;

/** How far the strongest gust pushes a treetop, in art pixels. */
const PUSH = 2.4;

/** A tree's own swing: the seconds one takes, and how fast it dies away (1 would not swing at all). */
const SWING = 2.2;
const DAMPING = 0.3;

/** The longest step the swing is moved in at once, in seconds, so a stalled tab cannot throw it. */
const STEP = 0.05;

/** How much wider and softer the breeze round a gust is than the gust, and how much wider its lane. */
const BREEZE_SPREAD = 2.2;
const BREEZE_LANE = 1.6;

/**
 * The gusts of one cycle. Each is a front that runs with the wind: the second
 * it enters, its speed in cells a second, the lane it runs in (cells across
 * the wind from the map's middle, and the lane's half width, 0 for a front as
 * wide as the world), its length in cells and its strength. One strong front
 * with a weak one on its heels crosses everything; four lesser ones each
 * cross a part, so the island is never moved all at once.
 */
const GUSTS = [
  { enter: 21.5, lane: 0, length: 9, reach: 0, speed: 7, strength: 1.2 },
  { enter: 23.1, lane: 0, length: 5, reach: 0, speed: 7, strength: 0.5 },
  { enter: 3, lane: -42, length: 6, reach: 34, speed: 6, strength: 0.6 },
  { enter: 9.5, lane: 30, length: 7, reach: 44, speed: 5.5, strength: 0.8 },
  { enter: 11.2, lane: 22, length: 6, reach: 48, speed: 5.5, strength: 0.9 },
  { enter: 15.5, lane: -64, length: 6, reach: 38, speed: 5, strength: 0.55 },
] as const;

/** How hard each weather blows, as a share of the gusts' own strength: a clear day is gentle, a storm half as strong again. */
export const WIND_FORCE = {
  clear: 0.7,
  clouds: 0.85,
  rain: 1,
  snow: 0.6,
  storm: 1.5,
} as const satisfies Record<Weather, number>;

/** Where the map's middle lies across the wind, which every lane is measured from. */
const MIDDLE =
  (WIND_FROM + WIND_SPAN / 2) * (WIND_HEADING[0] - WIND_HEADING[1]);

/** How far `value` lies from the nearest multiple of `span`. */
function wrapped(value: number, span: number) {
  return value - span * Math.round(value / span);
}

/** A soft hill: 1 at its middle, falling away over `width`. */
function bell(distance: number, width: number) {
  return Math.exp(-((distance / width) ** 2));
}

/**
 * How hard a gust blows over a point of the ground at `time` seconds: 0 in
 * still air, a little over 1 in the strongest front. The shaders compute the
 * same field, and from it the wide soft breeze that arrives before a gust.
 */
export function gustAt(x: number, z: number, time: number) {
  const along = x * WIND_HEADING[0] + z * WIND_HEADING[1];
  const across = z * WIND_HEADING[0] - x * WIND_HEADING[1] - MIDDLE;
  let sum = 0;
  for (const gust of GUSTS) {
    const front = wrapped(
      along - gust.speed * (time - gust.enter),
      gust.speed * WIND_CYCLE
    );
    const lane = gust.reach === 0 ? 1 : bell(across - gust.lane, gust.reach);
    sum += gust.strength * bell(front, gust.length) * lane;
  }
  return sum;
}

/** The second the leaves' pose belongs to: `time` held still between two poses, within one round of the flutter's own loop. */
export function poseOf(time: number) {
  return (Math.floor(time * WIND_POSES) / WIND_POSES) % (WIND_BEAT * 10);
}

/**
 * The swing of every tree, one texel of the map for each patch of ground: how
 * far its trees lean now, how fast that changes, and the same lean as the
 * byte the painter reads, 128 for upright.
 */
export function createWind() {
  const texels = WIND_SIDE * WIND_SIDE;
  return {
    lean: new Float32Array(texels),
    map: new Uint8Array(texels).fill(128),
    speed: new Float32Array(texels),
  };
}

/**
 * Moves every tree's swing on by `elapsed` seconds to `time`, in a wind
 * `force` times the gusts' own (0 for none). Each patch is a damped spring the
 * gust over it pushes: it leans as the front arrives, swings back past
 * upright once it has passed, and comes to rest.
 */
export function stepWind(
  wind: ReturnType<typeof createWind>,
  time: number,
  elapsed: number,
  force: number
) {
  const dt = Math.min(Math.max(elapsed, 0), STEP);
  const stiffness = (2 * Math.PI) / SWING;
  const texel = WIND_SPAN / WIND_SIDE;
  for (let row = 0; row < WIND_SIDE; row += 1) {
    for (let column = 0; column < WIND_SIDE; column += 1) {
      const at = row * WIND_SIDE + column;
      const x = WIND_FROM + (column + 0.5) * texel;
      const z = WIND_FROM + (row + 0.5) * texel;
      const push = PUSH * force * gustAt(x, z, time);
      const pull =
        stiffness * stiffness * (push - wind.lean[at]) -
        2 * DAMPING * stiffness * wind.speed[at];
      wind.speed[at] += pull * dt;
      wind.lean[at] += wind.speed[at] * dt;
      wind.map[at] = Math.round(
        128 + 127 * Math.min(1, Math.max(-1, wind.lean[at] / WIND_LEAN))
      );
    }
  }
}

/** A number as GLSL writes a float. */
function float(value: number) {
  return value.toFixed(4);
}

/** One gust as a line of the shader's field, the same numbers `fieldAt` reads. */
function gustLine(gust: (typeof GUSTS)[number]) {
  const front = `windBell(windWrapped(along - ${float(gust.speed)} * (uWind.z - ${float(gust.enter)}), ${float(gust.speed * WIND_CYCLE)}), ${float(gust.length)} * spread)`;
  const lane =
    gust.reach === 0
      ? ""
      : ` * windBell(across - (${float(gust.lane)}), ${float(gust.reach)} * (spread > 1.0 ? ${float(BREEZE_LANE)} : 1.0))`;
  return `  sum += ${float(gust.strength)} * ${front}${lane};`;
}

/**
 * The wind as the shaders read it, written from the numbers above so the two
 * can never differ. `uWind` is the map's start and side in cells, the second
 * of the cycle and the second of the pose; `uWindForce` scales the gusts.
 * `windShift` is how far a point moves, in whole art pixels: `weight` 0 holds
 * it still and 1 lets it go.
 */
export const WIND_GLSL = `
uniform sampler2D uLean;
uniform vec4 uWind;
uniform float uWindForce;
const vec2 WIND_HEADING = vec2(${float(WIND_HEADING[0])}, ${float(WIND_HEADING[1])});
float windWrapped(float value, float span) {
  return value - span * floor(value / span + 0.5);
}
float windBell(float distance, float width) {
  float ratio = distance / width;
  return exp(-ratio * ratio);
}
float windField(vec2 at, float spread) {
  float along = dot(at, WIND_HEADING);
  float across = at.y * WIND_HEADING.x - at.x * WIND_HEADING.y - (${float(MIDDLE)});
  float sum = 0.0;
${Arr.join(Arr.map(GUSTS, gustLine), "\n")}
  return sum * uWindForce;
}
vec3 windShift(vec2 at, float weight) {
  float lean = (texture(uLean, (at - uWind.x) / uWind.y).r * 255.0 - 128.0) / 127.0 * ${float(WIND_LEAN)};
  float push = min(1.0, 1.6 * windField(at, ${float(BREEZE_SPREAD)})) + 1.4 * windField(at, 1.0);
  float turn = 6.2831853 * (uWind.w / ${float(WIND_BEAT)} - dot(at, WIND_HEADING) / ${float(WIND_WAVE)});
  float side = floor(weight * (lean + push * (0.5 - 0.5 * cos(turn))) + 0.5);
  float lift = floor(weight * 0.6 * push * max(sin(turn), 0.0) + 0.5);
  return vec3(side, lift, floor(side * 0.25 + 0.5)) / ${float(TILE)};
}
`;

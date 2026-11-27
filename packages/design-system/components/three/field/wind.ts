/**
 * The one wind every outdoor scene shares. It blows along a fixed heading
 * in fronts of gusts that travel downwind, with finer turbulence riding on
 * them, and it answers the same push for the same place and time on every
 * device. Grass, reeds, trees, ripples, smoke and flags all read it, so a
 * whole scene leans and recovers together. It is a handful of sines, cheap
 * enough to run for every vertex of a lawn and for every frame in script.
 */

/** The unit direction the wind blows toward, as x then z. */
export const WIND_HEADING = [0.8, 0.6] as const;

/** How many radians of a gust front pass a place per scene unit, and per second. */
const FRONT = { place: 0.19, time: 0.9 } as const;

/** How the fronts bow across the wind, per scene unit and per second, and by how many radians. */
const BOW = { place: 0.13, reach: 1.7, time: 0.21 } as const;

/** The turbulence that rides on a gust: along and across the wind, and in time. */
const FLUTTER = { across: 2.3, along: 1.7, skew: 0.9, slow: 1.3, time: 3.1 };

/** How much of the push never drops, however calm the moment is. */
const CALM = 0.18;

/** How much of a gust's push comes from the turbulence riding on it. */
const ROUGH = 0.3;

/**
 * How hard the wind pushes at a place and a moment, from 0 in a lull to 1
 * at the height of a gust. `x` and `z` are a place on the ground in scene
 * units and `time` is in seconds. Whatever bends in the wind leans along
 * `WIND_HEADING` by this much of its own give.
 */
export function windAt(x: number, z: number, time: number) {
  const along = x * WIND_HEADING[0] + z * WIND_HEADING[1];
  const across = z * WIND_HEADING[0] - x * WIND_HEADING[1];
  const bow = BOW.reach * Math.sin(across * BOW.place + time * BOW.time);
  const gust =
    0.5 + 0.5 * Math.sin(along * FRONT.place - time * FRONT.time + bow);
  const flutter =
    Math.sin(
      along * FLUTTER.along - time * FLUTTER.time + across * FLUTTER.skew
    ) * Math.sin(across * FLUTTER.across + time * FLUTTER.slow);
  const push = gust * gust * (1 - ROUGH + ROUGH * (0.5 + 0.5 * flutter));
  return CALM + (1 - CALM) * push;
}

/** A number written the way a shader reads a float. */
function float(value: number) {
  return value.toFixed(4);
}

/**
 * The same wind for a shader: `windAt(place, time)` answers what the script
 * function answers, and `WIND_HEADING` is the direction it blows toward. A
 * program that bends something in the wind includes this once.
 */
export const WIND_SHADER = `
const vec2 WIND_HEADING = vec2(${float(WIND_HEADING[0])}, ${float(WIND_HEADING[1])});
float windAt(vec2 place, float time) {
  float along = dot(place, WIND_HEADING);
  float across = place.y * WIND_HEADING.x - place.x * WIND_HEADING.y;
  float bow = ${float(BOW.reach)} * sin(across * ${float(BOW.place)} + time * ${float(BOW.time)});
  float gust = 0.5 + 0.5 * sin(along * ${float(FRONT.place)} - time * ${float(FRONT.time)} + bow);
  float flutter = sin(along * ${float(FLUTTER.along)} - time * ${float(FLUTTER.time)} + across * ${float(FLUTTER.skew)}) * sin(across * ${float(FLUTTER.across)} + time * ${float(FLUTTER.slow)});
  float push = gust * gust * (${float(1 - ROUGH)} + ${float(ROUGH)} * (0.5 + 0.5 * flutter));
  return ${float(CALM)} + ${float(1 - CALM)} * push;
}
`;

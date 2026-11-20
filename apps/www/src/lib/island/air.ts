import { LAND_GLSL } from "@/lib/island/land/glsl";
import type { Brush } from "@/lib/island/land/stroke";
import { WIND_GLSL } from "@/lib/island/wind";

/**
 * The GLSL programs of what moves in the air over the land (ADR 0047, D33,
 * D36, D38 and D41; ADR 0050, W10): the falling weather and its splashes, the
 * chimneys' smoke, the fireflies and the bursts a change throws up; the
 * leaves and the butterflies are in `lib/island/flutter.ts`. Each reads the
 * one wind of D32, what lands reads the ground from the window of land about
 * the camera (`fieldAt`), and every place comes from the time alone, so
 * nothing is uploaded while it moves and all of it works at any place of the
 * land, on either side of the origin.
 */

/**
 * The weather program (ADR 0047, D33): rain as short streaks and snow as
 * flakes, each falling along the wind until it meets the higher of the ground
 * and the water at its place, read from the window of land. Each particle is
 * a seed: every cycle it picks where it lands, falls there from the sky over
 * the camera's target, and its place at any moment comes from the time, so
 * nothing is uploaded while it falls. It falls over all the camera sees,
 * however far the camera stands back. The splash pass (`uSplash` 1) draws
 * what a landing drop leaves: two droplets thrown up from the ground, a ring
 * spreading on water.
 */
export const WEATHER_VERTEX = `#version 300 es
layout(location = 0) in vec3 aSeed;
layout(location = 1) in float aTail;
uniform mat4 uViewProjection;
uniform vec3 uTarget;
uniform float uTime;
uniform float uSpeed;
uniform float uLength;
uniform float uSway;
uniform float uSplash;
uniform float uArea;
uniform float uTop;
${WIND_GLSL}
${LAND_GLSL}
out float vTail;
out float vRing;
out float vAge;
// Seconds a splash stays on ground, and a ring on water.
const float SPLASH = 0.16;
const float RING = 0.5;
// Where a drop that lands at a place stops: the higher of the ground and the water's face, and 1 on water.
vec2 surfaceAt(vec2 at) {
  vec4 field = fieldAt(at);
  return vec2(max(field.r, field.g), step(field.r + 0.02, field.g));
}
void main() {
  vTail = aTail;
  vRing = 0.0;
  vAge = 0.0;
  float top = uTarget.y + uTop;
  // One cycle is long enough to fall from the sky to the lowest ground in view.
  float period = (uTop + 4.0) / uSpeed;
  float clock = uTime / period + aSeed.z;
  float cycle = floor(clock);
  // Each cycle the drop lands somewhere new round the target, at a time of its own within the cycle.
  vec2 land = uTarget.xz + (fract(aSeed.xy + cycle * vec2(0.6180339, 0.3819660)) - 0.5) * uArea;
  vec2 surface = surfaceAt(land);
  float fall = (top - surface.x) / uSpeed;
  float since = fract(clock) * period - fall;
  // The wind carries the drop as it falls: a breeze always, and more under a gust's front.
  vec2 drift = WIND_HEADING * uWindForce * (1.5 + 4.0 * windField(land, 1.0));
  if (uSplash > 0.5) {
    float last = surface.y > 0.5 ? RING : SPLASH;
    if (since < 0.0 || since > last || (surface.y > 0.5 && aTail > 0.5)) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vAge = since / last;
    vRing = surface.y;
    // Two droplets thrown up and out from where the drop hit, falling back as they go.
    float side = (aTail - 0.5) * 2.0 * (0.06 + since * 0.9);
    float up = surface.y > 0.5 ? 0.0 : since * 2.2 - since * since * 9.0;
    vec3 at = vec3(land.x + side * WIND_HEADING.y, surface.x + 0.04 + up, land.y - side * WIND_HEADING.x);
    gl_Position = uViewProjection * vec4(at, 1.0);
    gl_PointSize = surface.y > 0.5 ? 2.0 + 5.0 * vAge : 1.0;
    return;
  }
  if (since >= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float left = -since;
  vec3 velocity = vec3(drift.x, -uSpeed, drift.y);
  vec3 head = vec3(land.x, surface.x, land.y) - velocity * left;
  head.x += sin(uTime * 0.8 + aSeed.z * 20.0) * uSway;
  // A streak trails back along the way it came.
  vec3 position = head - normalize(velocity) * aTail * uLength;
  gl_Position = uViewProjection * vec4(position, 1.0);
  gl_PointSize = 2.0;
}`;

export const WEATHER_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec4 uColor;
in float vTail;
in float vRing;
in float vAge;
out vec4 color;
void main() {
  if (vRing > 0.5) {
    // A ring lying on the water: an ellipse, its inside clear, fading as it spreads.
    vec2 at = gl_PointCoord - 0.5;
    at.y *= 2.0;
    float reach = length(at);
    if (reach > 0.5 || reach < 0.3) discard;
    color = vec4(uColor.rgb, uColor.a * (1.0 - vAge));
    return;
  }
  // A drop is brightest at its head and fades along its tail; a splash fades as it falls back.
  color = vec4(uColor.rgb, min(1.0, uColor.a * (1.0 - vTail * 0.75) * (vAge > 0.0 ? 1.6 : 1.0)) * (1.0 - vAge * 0.6));
}`;

/**
 * The smoke program (ADR 0047, D33): puffs rising from every chimney, twelve to
 * a chimney, each a soft round blot of whole art pixels that grows as it
 * rises, slows as it cools and leans farther the higher it gets, carried by
 * the one wind of D32. A puff's place comes from the time alone. `aChimney`
 * is one chimney an instance, three numbers each: the place smoke leaves it,
 * x, y, z in blocks.
 */
export const SMOKE_VERTEX = `#version 300 es
layout(location = 0) in vec3 aChimney;
uniform mat4 uViewProjection;
${WIND_GLSL}
out float vAge;
const float PUFFS = 12.0;
const float LIFE = 7.0;
void main() {
  float seed = fract(sin(dot(aChimney.xz, vec2(12.9898, 78.233))) * 43758.5453);
  float age = fract(uWind.z / LIFE + float(gl_VertexID) / PUFFS + seed);
  vAge = age;
  // Warm smoke climbs straight out of the chimney first and bends with the wind as it cools, still climbing, so from the island's high camera it reads as rising and never as falling.
  float rise = 3.0 * age + 3.4 * sqrt(age);
  vec2 lean = WIND_HEADING * (0.45 * uWindForce + windField(aChimney.xz, 2.2)) * pow(age, 1.8) * 2.2;
  float sway = sin(age * 7.0 + seed * 20.0) * 0.18 * age;
  vec3 at = aChimney + vec3(lean.x + sway * WIND_HEADING.y, rise, lean.y - sway * WIND_HEADING.x);
  gl_Position = uViewProjection * vec4(at, 1.0);
  gl_PointSize = floor(3.0 + 6.0 * age + 0.5);
}`;

export const SMOKE_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec3 uTint;
in float vAge;
out vec4 color;
void main() {
  vec2 at = gl_PointCoord - 0.5;
  if (dot(at, at) > 0.25) discard;
  // A puff swells in, then thins away as it rises.
  float alpha = smoothstep(0.0, 0.06, vAge) * (1.0 - vAge * vAge) * 0.75;
  color = vec4(uTint, alpha);
}`;

/**
 * The firefly program (ADR 0047, D36): after dusk, a few dozen fireflies hover
 * over the meadow, each a single warm art pixel that drifts in a loop of its
 * own and glows for a breath every few seconds. None in rain or snow. `aHome`
 * is one firefly a point, three numbers each: the middle of its loop, x, y, z
 * in blocks, about a block over the ground.
 */
export const FIREFLY_VERTEX = `#version 300 es
layout(location = 0) in vec3 aHome;
uniform mat4 uViewProjection;
uniform float uTime;
out float vGlow;
void main() {
  float seed = fract(sin(dot(aHome.xz, vec2(12.9898, 78.233))) * 43758.5453);
  float turn = uTime * (0.25 + 0.2 * seed) + seed * 40.0;
  vec3 at = aHome + vec3(cos(turn) * 0.7, 0.5 + 0.6 * sin(turn * 0.7 + seed * 9.0), sin(turn * 1.3) * 0.7);
  float beat = fract(uTime / (2.5 + 2.0 * seed) + seed);
  vGlow = smoothstep(0.0, 0.12, beat) * (1.0 - smoothstep(0.12, 0.5, beat));
  gl_Position = uViewProjection * vec4(at, 1.0);
  gl_PointSize = vGlow > 0.6 ? 2.0 : 1.0;
}`;

export const FIREFLY_FRAGMENT = `#version 300 es
precision mediump float;
uniform float uNight;
in float vGlow;
out vec4 color;
void main() {
  if (vGlow * uNight < 0.05) discard;
  color = vec4(0.86, 1.0, 0.5, min(1.0, vGlow * uNight * 1.2));
}`;

/** How many bursts of dust or chips the air holds at once, the newest replacing the oldest. */
export const BURSTS = 8;

/** Bits of one burst. */
export const BITS = 14;

/**
 * What flies where the learner changes the world (ADR 0047, D38; ADR 0050,
 * W2), by what they did: the linear color of its bits, and whether they leap
 * as chips do or roll out low as dust does. A thing set down puffs pale dust
 * at its foot and a thing taken throws chips of wood; a path throws its
 * gravel, a meadow its petals, sand its grains, grass and a clearing their
 * green, the brushes that move the ground its earth, and a pond its water.
 */
export const BURST_LOOKS = {
  chips: { color: [0.62, 0.45, 0.28], leaps: true },
  clear: { color: [0.3, 0.55, 0.26], leaps: true },
  dust: { color: [0.86, 0.82, 0.74], leaps: false },
  grass: { color: [0.4, 0.68, 0.34], leaps: false },
  level: { color: [0.56, 0.43, 0.3], leaps: false },
  lower: { color: [0.5, 0.38, 0.26], leaps: true },
  meadow: { color: [0.98, 0.72, 0.8], leaps: false },
  path: { color: [0.72, 0.58, 0.42], leaps: false },
  pond: { color: [0.62, 0.84, 0.95], leaps: true },
  raise: { color: [0.56, 0.43, 0.3], leaps: true },
  sand: { color: [0.94, 0.86, 0.64], leaps: false },
} as const satisfies Record<Brush | "chips" | "dust", unknown>;

/** What a burst is thrown for: a thing set down (`dust`), a thing taken (`chips`), or the brush that touched the land. */
export type Burst = keyof typeof BURST_LOOKS;

/**
 * The burst program (ADR 0047, D38): what flies when the learner changes the
 * world. Chips leap up and out of the place and fall back under gravity; dust
 * rolls out low in a ring. Each burst lives six tenths of a second; a bit's
 * place comes from the time since its burst. `uBursts` is one burst a
 * vector: the place it left, x, y, z in blocks, and the second it began,
 * below zero for none; `uTints` is its color and 1 for bits that leap.
 */
export const DUST_VERTEX = `#version 300 es
uniform mat4 uViewProjection;
uniform float uTime;
uniform vec4 uBursts[${BURSTS}];
uniform vec4 uTints[${BURSTS}];
out vec4 vColor;
const float LIFE = 0.6;
void main() {
  int burst = gl_VertexID / ${BITS};
  float bit = float(gl_VertexID - burst * ${BITS});
  vec4 at = uBursts[burst];
  vec4 kind = uTints[burst];
  float age = uTime - at.w;
  if (at.w < 0.0 || age < 0.0 || age > LIFE) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float seed = fract(sin(bit * 12.9898 + at.x * 78.233 + at.z * 37.719) * 43758.5453);
  float turn = bit / ${BITS.toFixed(1)} * 6.2831853 + seed;
  bool chips = kind.w > 0.5;
  // A bit flies out fast and slows as the air takes it; chips leap high and fall back, dust only rolls out low.
  float reach = (chips ? 1.2 + seed * 0.7 : 0.6 + seed * 0.3) * (1.0 - exp(-age * 6.0));
  float rise = chips ? (4.2 + seed * 2.0) * age - 13.0 * age * age : (0.9 + seed * 0.5) * age - 2.0 * age * age;
  // Chips leave from a little over the place, dust from the ground at it.
  vec3 start = at.xyz + vec3(0.0, chips ? 0.3 : 0.05, 0.0);
  vec3 place = start + vec3(cos(turn) * reach, max(rise, -0.3), sin(turn) * reach);
  // Half the bits catch the light and half are in shade, so a burst reads against ground of its own color.
  float tone = mod(bit, 2.0) < 0.5 ? 1.3 : 0.62;
  vColor = vec4(min(vec3(1.0), kind.rgb * tone), 1.0 - smoothstep(0.6, 1.0, age / LIFE));
  gl_Position = uViewProjection * vec4(place, 1.0);
  gl_PointSize = chips ? (age < 0.2 ? 3.0 : 2.0) : floor(3.0 + 2.0 * age / LIFE + 0.5);
}`;

export const DUST_FRAGMENT = `#version 300 es
precision mediump float;
in vec4 vColor;
out vec4 color;
void main() {
  color = vColor;
}`;

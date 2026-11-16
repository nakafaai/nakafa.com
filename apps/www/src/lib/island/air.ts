import { SPAN } from "@repo/backend/confect/island/world";
import { WIND_GLSL } from "@/lib/island/wind";

/**
 * The GLSL programs of what moves in the air over the island (ADR 0047, D33
 * and D36): the falling weather and its splashes, the chimneys' smoke and the
 * fireflies. Each reads the one wind of D32, and every place comes from the
 * time alone, so nothing is uploaded while it moves.
 */

/**
 * The weather program (ADR 0047, D33): rain as short streaks and snow as
 * flakes, each falling along the wind until it meets the first thing over its
 * column (the column map, `lib/island/ground.ts`), so a roof keeps the ground
 * under it dry. Each particle is a seed: every cycle it picks where it lands,
 * falls there from the sky over the camera's target, and its place at any
 * moment comes from the time, so nothing is uploaded while it falls. It falls
 * over all the camera sees, however far the camera stands back. The
 * splash pass (`uSplash` 1) draws what a landing drop leaves: two droplets
 * thrown up from ground or a roof, a ring spreading on water.
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
uniform float uSea;
uniform float uArea;
uniform float uTop;
uniform sampler2D uColumns;
${WIND_GLSL}
out float vTail;
out float vRing;
out float vAge;
const float SIDE = ${SPAN.toFixed(1)};
// Seconds a splash stays on ground, and a ring on water.
const float SPLASH = 0.16;
const float RING = 0.5;
// Where a drop that lands at a place stops: the height, and 1 on water.
vec2 surfaceAt(vec2 at) {
  vec2 cell = floor(at);
  if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= SIDE || cell.y >= SIDE) {
    return vec2(uSea, 1.0);
  }
  float code = floor(texelFetch(uColumns, ivec2(cell), 0).r * 255.0 + 0.5);
  float water = mod(code, 2.0);
  return vec2(floor(code / 2.0) - 0.125 * water, water);
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
 * the one wind of D32. A puff's place comes from the time alone.
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
  float rise = 3.6 * sqrt(age);
  vec2 lean = WIND_HEADING * (0.5 * uWindForce + 2.0 * windField(aChimney.xz, 2.2)) * age * age * 3.0;
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
 * own and glows for a breath every few seconds. None in rain or snow.
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
 * The dust program (ADR 0047, D38): what flies when the learner changes a
 * block. A dug block throws chips of its own color up and out, falling back
 * under gravity; a placed block puffs a ring of dust at its foot. Each burst
 * lives half a second; a bit's place comes from the time since its burst.
 */
export const DUST_VERTEX = `#version 300 es
uniform mat4 uViewProjection;
uniform float uTime;
uniform vec4 uBursts[${BURSTS}];
uniform vec4 uKinds[${BURSTS}];
out vec4 vColor;
const float LIFE = 0.6;
void main() {
  int burst = gl_VertexID / ${BITS};
  float bit = float(gl_VertexID - burst * ${BITS});
  vec4 at = uBursts[burst];
  vec4 kind = uKinds[burst];
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
  // Chips leave from the mouth of the hole, dust from the foot of the new block.
  vec3 start = at.xyz + vec3(0.5, chips ? 1.15 : 0.05, 0.5);
  vec3 place = start + vec3(cos(turn) * reach, max(rise, -0.9), sin(turn) * reach);
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

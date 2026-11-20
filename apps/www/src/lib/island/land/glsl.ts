import { HORIZON_STEP, SEAM, WINDOW } from "@/lib/island/land/window";
import { NOISE_GLSL, SKY_ROW } from "@/lib/island/shaders";
import { TOON_GLSL } from "@/lib/island/toon";
import { WATER_GLSL } from "@/lib/island/water";
import { WIND_GLSL } from "@/lib/island/wind";

/** How many lamps light the ground at once: the nearest ones to the camera (ADR 0050, W10). */
export const LAMPS = 8;

/** The side of the patch the grass blades fill around the camera, in blocks; it wraps, so the blades never run out. */
export const MEADOW = 48;

/**
 * The land as the shaders read it (ADR 0050, W10), in two levels. The window
 * about the camera holds a lattice point a block: the ground's height, the
 * water's face and a river's run in one texture, what covers the ground in
 * another. The horizon holds the same every `HORIZON_STEP` blocks, far past
 * the window. `uFields`, `uKinds`, `uOrigin` and `uStep` are those of the
 * level being drawn (`uLevel` 0 for the window, 1 for the horizon), and the
 * window's ground eases into the horizon's toward its rim, so the two meet
 * along `SEAM` with no step between them.
 */
export const LAND_GLSL = `
uniform sampler2D uFields;
uniform sampler2D uKinds;
uniform sampler2D uFar;
uniform sampler2D uFarKinds;
uniform vec2 uOrigin;
uniform vec2 uNear;
uniform vec2 uFarOrigin;
uniform float uStep;
uniform float uLevel;
const float WINDOW = ${WINDOW.toFixed(1)};
const float HORIZON_STEP = ${HORIZON_STEP.toFixed(1)};
const float SEAM = ${SEAM.toFixed(1)};
vec2 windowUv(vec2 place) {
  return (place - uOrigin) / (WINDOW * uStep) + 0.5 + 0.5 / WINDOW;
}
vec2 horizonUv(vec2 place) {
  return (place - uFarOrigin) / (WINDOW * HORIZON_STEP) + 0.5 + 0.5 / WINDOW;
}
// How far a place lies from the window's middle, along the farther of its two axes.
float reachAt(vec2 place) {
  vec2 off = abs(place - uNear);
  return max(off.x, off.y);
}
// How much of the horizon's ground the window takes at a place: none over most of it, all of it at the seam.
float handAt(vec2 place) {
  return uLevel > 0.5 ? 0.0 : smoothstep(SEAM - 24.0, SEAM, reachAt(place));
}
// The ground at a place: r its height, g the water's face, ba which way a river runs.
vec4 fieldAt(vec2 place) {
  vec4 field = texture(uFields, windowUv(place));
  float hand = handAt(place);
  return hand > 0.0 ? mix(field, texture(uFar, horizonUv(place)), hand) : field;
}
// What covers the ground at a place: r a path, g sand, b a meadow, a how wooded it is.
vec4 kindAt(vec2 place) {
  vec4 kind = texture(uKinds, windowUv(place));
  float hand = handAt(place);
  return hand > 0.0 ? mix(kind, texture(uFarKinds, horizonUv(place)), hand) : kind;
}
// How much water stands over the ground at a place, in blocks; below zero on dry land.
float deepAt(vec2 place) {
  vec4 field = fieldAt(place);
  return field.g - field.r;
}
// Which way the ground faces at a place, from the heights half a step either side of it.
vec3 slantAt(vec2 place) {
  float side = 0.5 * uStep;
  return normalize(vec3(
    fieldAt(place - vec2(side, 0.0)).r - fieldAt(place + vec2(side, 0.0)).r,
    uStep,
    fieldAt(place - vec2(0.0, side)).r - fieldAt(place + vec2(0.0, side)).r
  ));
}`;

/** The shadow of the clouds drifting over the land, cut into whole art pixels, and the turf's own tones. */
const GROUND_GLSL = `
// The land's paints are written as they look in full sun; the sun and the sky together light a face past 1, so each is held back by this much.
const float EXPOSURE = 0.72;
float cloudOf(vec2 place) {
  vec2 pixel = floor((place + vec2(uTime * 0.7, uTime * 0.3)) * 4.0) / 4.0;
  float cover = noiseOf(pixel / 15.0) * 0.7 + noiseOf(pixel / 6.0) * 0.3;
  return step(0.6, cover);
}
// The turf at a place: two tones of meadow green in broad patches, deeper under trees, lighter and warmer where flowers grow.
vec3 turfOf(vec2 place, vec4 kind) {
  float tone = step(0.5, noiseOf(place * 0.07 + 4.0)) * 0.5 + step(0.6, noiseOf(place * 0.5)) * 0.5;
  vec3 open = mix(vec3(0.36, 0.68, 0.35), vec3(0.42, 0.73, 0.37), tone);
  vec3 wooded = mix(vec3(0.2, 0.5, 0.32), vec3(0.25, 0.56, 0.33), tone);
  vec3 flowered = mix(vec3(0.5, 0.76, 0.36), vec3(0.57, 0.8, 0.39), tone);
  vec3 turf = mix(open, wooded, smoothstep(0.4, 0.7, kind.a));
  return mix(turf, flowered, smoothstep(0.45, 0.55, kind.b) * 0.7) * uTurf;
}`;

/**
 * The land program (ADR 0050, W10): one grid of the window, each corner
 * raised to the ground's height or, for the water pass, to the water's face.
 * The solid pass paints the ground in flat tones by what covers it, rock on
 * what is steep and bare earth along the banks, lit in the toon bands under
 * the sun's shadow map; the water pass lays the water over it by how much of
 * it lies under each pixel.
 */
export const LAND_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPoint;
uniform mat4 uViewProjection;
uniform float uWater;
${LAND_GLSL}
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec2 place = aPoint * uStep + uOrigin;
  vec4 field = fieldAt(place);
  float height = uWater > 0.5 ? max(field.g, field.r - 0.6) : field.r;
  int at = uWater > 0.5 ? 1 : 0;
  vNormal = normalize(vec3(
    fieldAt(place - vec2(uStep, 0.0))[at] - fieldAt(place + vec2(uStep, 0.0))[at],
    2.0 * uStep,
    fieldAt(place - vec2(0.0, uStep))[at] - fieldAt(place + vec2(0.0, uStep))[at]
  ));
  vWorld = vec3(place.x, height, place.y);
  gl_Position = uViewProjection * vec4(vWorld, 1.0);
}`;

export const LAND_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 uSun;
uniform vec3 uAmbient;
uniform vec3 uLamp;
uniform vec4 uLamps[${LAMPS}];
uniform vec2 uFogRange;
uniform float uTime;
uniform float uWater;
uniform float uSea;
uniform vec3 uEye;
uniform vec3 uFocus;
uniform vec3 uTurf;
uniform vec4 uRing;
uniform vec3 uRingTint;
uniform float uWet;
uniform float uSnow;
${SKY_ROW}
${WIND_GLSL}
${LAND_GLSL}
in vec3 vWorld;
in vec3 vNormal;
layout(location = 0) out vec4 color;
layout(location = 1) out vec4 surface;
${NOISE_GLSL}
${GROUND_GLSL}
${TOON_GLSL}
${WATER_GLSL}
// The warm light of the lamps near a place, which shows as the day goes.
vec3 lampsAt(vec3 place) {
  float sum = 0.0;
  for (int index = 0; index < ${LAMPS}; index++) {
    vec4 lamp = uLamps[index];
    float away = distance(place, lamp.xyz);
    sum += lamp.w / (1.0 + away * away * 0.3);
  }
  return uLamp * min(1.0, sum);
}
void main() {
  vec3 normal = uWater > 0.5 ? normalize(vNormal) : slantAt(vWorld.xz);
  vec2 art = floor(vWorld.xz * 16.0) / 16.0;
  // The window draws what lies inside the seam and the horizon what lies past it, so every pixel of land is drawn once.
  float reach = reachAt(vWorld.xz);
  if (uLevel > 0.5 ? reach < SEAM : reach > SEAM) discard;
  // Past the horizon's edge nothing is known of the land, so it thins into the sky before it ends.
  vec2 off = abs(vWorld.xz - uFarOrigin);
  float brink = WINDOW * 0.5 * HORIZON_STEP;
  float edge = smoothstep(brink - 260.0, brink - 40.0, max(off.x, off.y));
  float fog = max(edge, smoothstep(uFogRange.x, uFogRange.y, distance(vWorld, uEye)));
  float cloud = cloudOf(vWorld.xz);
  if (uWater > 0.5) {
    float deep = deepAt(vWorld.xz);
    if (deep < 0.0) discard;
    float foam = 0.0;
    vec4 water = waterOf(vWorld, uEye, uToward, uTime, 1.0, foam);
    // Where the water's face drops, it falls (D52): white streaks pour down it in whole art pixels, a few broad ones and many thin.
    float fall = smoothstep(0.3, 1.1, length(normal.xz) / max(normal.y, 0.05));
    vec2 sheet = floor(vec2(vWorld.x + vWorld.z, vWorld.y) * 16.0);
    float pour = noiseOf(vec2(sheet.x * 0.55, (sheet.y + uTime * 44.0) * 0.09));
    float streak = min(1.0, step(0.58, pour) + step(0.8, hashOf(vec2(sheet.x, floor((sheet.y + uTime * 60.0) * 0.25)))) * 0.6);
    vec3 paint = mix(water.rgb, mix(vec3(0.46, 0.74, 0.88), vec3(0.94, 0.98, 1.0), streak), fall);
    foam = max(foam, fall * streak * 0.55);
    float lit = sunlitAt(vWorld, vec3(0.0, 1.0, 0.0)) * (1.0 - 0.4 * cloud);
    vec3 light = toonLight(uAmbient, uSun, vec3(0.0, 1.0, 0.0), lit, 1.0) + lampsAt(vWorld);
    light = floor(light * 12.0 + 0.5) / 12.0;
    vec3 shown = mix(paint * light, vec3(0.97, 0.99, 1.0) * min(vec3(1.0), light + 0.12), foam);
    color = vec4(mix(shown, skyRow(gl_FragCoord.y / uRows), fog), mix(mix(water.a, 0.9, fall), 1.0, foam));
    surface = vec4(0.5, 1.0, 0.5, 0.0);
    return;
  }
  // What covers the ground is read a little off its place, so one cover meets the next along a wandering line and never a straight one.
  vec2 wander = art + (vec2(noiseOf(art * 0.9), noiseOf(art * 0.9 + 9.0)) - 0.5) * 1.5;
  vec4 kind = kindAt(wander);
  float deep = fieldAt(vWorld.xz).g - vWorld.y;
  float speck = hashOf(floor(art * 6.0));
  float tone = step(0.55, noiseOf(art * 0.4 + 2.0));
  vec3 grass = turfOf(art, kind);
  // Past the window no tree is drawn, so the woods show as their crowns: darker green in blotches the size of a tree.
  float afar = max(uLevel, handAt(vWorld.xz));
  float crown = step(0.42, noiseOf(art * 0.3 + 17.0)) * (0.82 + 0.18 * step(0.5, noiseOf(art * 0.9 + 5.0)));
  grass = mix(grass, vec3(0.17, 0.43, 0.27) * uTurf * crown, afar * smoothstep(0.5, 0.72, kind.a) * step(0.01, crown));
  // Leaf litter on the forest floor.
  grass = mix(grass, grass * vec3(0.8, 0.86, 0.8), step(0.9, speck) * smoothstep(0.6, 0.9, kind.a));
  // A gust shows on the meadow (D32): the grass under its front turns a tone lighter.
  grass *= 1.0 + 0.08 * step(0.55, windField(art, 1.0));
  // Where no blade is drawn, far from the camera, the tufts are dots; near it the ground between the blades is in their shade.
  float lawn = smoothstep(17.0, 23.0, distance(art, uFocus.xz));
  grass *= mix(0.86, 1.0 + 0.07 * step(0.72, hashOf(floor(art * vec2(4.0, 2.4)))), lawn);
  vec3 path = mix(vec3(0.71, 0.55, 0.39), vec3(0.77, 0.61, 0.44), tone);
  path = mix(path, vec3(0.63, 0.49, 0.35), step(0.975, speck));
  vec3 sand = mix(vec3(0.92, 0.84, 0.62), vec3(0.97, 0.9, 0.7), tone);
  sand = mix(sand, vec3(0.87, 0.78, 0.57), step(0.985, speck));
  float slope = 1.0 - normal.y;
  float rocky = smoothstep(0.24, 0.3, slope);
  float sandy = smoothstep(0.47, 0.53, kind.g);
  // Rock in three flat bands that follow the cliff's height, moss where it is less steep.
  float layer = floor(clamp(noiseOf(vec2(vWorld.y * 1.5, (art.x + art.y) * 0.22)), 0.0, 0.999) * 3.0) * 0.5;
  vec3 rock = mix(vec3(0.5, 0.5, 0.53), vec3(0.74, 0.73, 0.71), layer);
  rock = mix(rock, vec3(0.34, 0.56, 0.3) * uTurf, step(0.62, noiseOf(art * 1.3 + 30.0)) * (1.0 - smoothstep(0.34, 0.5, slope)));
  vec3 paint = mix(grass, sand, sandy);
  paint = mix(paint, path, smoothstep(0.46, 0.52, kind.r));
  // Bare earth where the land meets the water, darker where it is wet.
  float bank = step(-deep / max(length(normal.xz) / normal.y, 0.06), 0.9) * step(-0.45, deep) * (1.0 - step(0.0, deep)) * (1.0 - sandy);
  paint = mix(paint, mix(path, path * 0.82, smoothstep(-0.16, -0.1, deep)), bank);
  // A cliff stands mostly out of the sun, so its rock is written lighter than the ground's paints.
  paint = mix(paint, rock * 1.3, rocky);
  vec3 bed = mix(mix(vec3(0.66, 0.62, 0.5), vec3(0.72, 0.68, 0.54), tone), sand * 0.94, smoothstep(0.3, 0.6, kind.g));
  paint = mix(paint, bed, step(0.0, deep)) * EXPOSURE;
  // What the weather left (D33): wet ground darkens and cools, and snow settles art pixel by art pixel, drifts first, then whole fields.
  float dry = 1.0 - step(0.0, deep);
  paint = mix(paint, paint * vec3(0.74, 0.77, 0.85), uWet * dry * (1.0 - rocky * 0.45));
  vec2 grain = floor(vWorld.xz * 16.0);
  float spread = noiseOf(grain / 40.0) * 0.6 + noiseOf(grain / 9.0) * 0.28 + hashOf(grain) * 0.12;
  paint = mix(paint, vec3(0.92, 0.95, 1.0), step(spread, uSnow * dry * step(slope, 0.4)) * 0.94);
  // Rain pools on flat ground and shows the sky.
  float pool = uWet * dry * step(0.62, noiseOf(art * 0.35 + 3.0) * 0.6 + noiseOf(art * 1.3) * 0.4) * (1.0 - smoothstep(0.03, 0.1, slope));
  paint = mix(paint, mix(uHorizon, uZenith, 0.4), pool * 0.5);
  float lit = sunlitAt(vWorld, normal) * (1.0 - 0.4 * cloud);
  vec3 light = toonLight(uAmbient, uSun, normal, lit, mix(0.7 + 0.3 * normal.y, 1.25, rocky));
  light += lampsAt(vWorld);
  // Under the water the light fades with depth, and the swell's caustics play over the bed in whole art pixels.
  if (deep > 0.0) {
    float a = noiseOf(art * 1.7 + vec2(uTime * 0.5, uTime * 0.3));
    float b = noiseOf(art * 2.3 - vec2(uTime * 0.4, -uTime * 0.35));
    float caustic = step(abs(a - b), 0.05) * exp(-0.3 * deep);
    light = light * mix(1.0, 0.5, 1.0 - exp(-0.3 * deep)) + uSun * caustic * 0.7;
  }
  light = floor(light * 12.0 + 0.5) / 12.0;
  vec3 shown = paint * light;
  // The ring a brush or a thing in hand lays on the ground: two art pixels wide, in the tint that says whether the press will take.
  float rim = distance(art, uRing.xy);
  shown = mix(shown, uRingTint, uRing.w * step(uRing.z - 0.14, rim) * step(rim, uRing.z));
  color = vec4(mix(shown, skyRow(gl_FragCoord.y / uRows), fog), 1.0);
  surface = vec4(normal * 0.5 + 0.5, 0.0);
}`;

/** The land seen from the sun, depth only, into the shadow map (D43). */
export const SHADE_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPoint;
uniform mat4 uViewProjection;
${LAND_GLSL}
void main() {
  vec2 place = aPoint * uStep + uOrigin;
  gl_Position = uViewProjection * vec4(place.x, fieldAt(place).r, place.y, 1.0);
}`;

export const SHADE_FRAGMENT = `#version 300 es
precision mediump float;
void main() {}`;

/**
 * The blade program (ADR 0050, W10): every blade of grass in a patch that
 * wraps around the camera, each a leaf of five corners turned to the lens. A
 * blade stands whole or not at all, by what covers its root, so the turf
 * thins out at a path, a beach, a bank and a cliff instead of shrinking. It
 * takes its turf's color with a lighter tip, leans with the wind and its
 * gusts, and a few in a meadow carry a flower.
 */
export const BLADE_VERTEX = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aBlade;
uniform mat4 uViewProjection;
uniform vec3 uSun;
uniform vec3 uAmbient;
uniform vec3 uLamp;
uniform vec4 uLamps[${LAMPS}];
uniform vec3 uFocus;
uniform vec2 uSide;
uniform vec3 uTurf;
uniform float uTime;
uniform float uWet;
uniform float uSnow;
${WIND_GLSL}
${LAND_GLSL}
${NOISE_GLSL}
${GROUND_GLSL}
${TOON_GLSL}
out vec3 vLow;
out vec3 vHigh;
out vec4 vPetal;
out float vUp;
out vec3 vWorld;
void main() {
  float first = aBlade.z;
  float second = aBlade.w;
  vec2 root = aBlade.xy + ${MEADOW.toFixed(1)} * floor((uFocus.xz - aBlade.xy) / ${MEADOW.toFixed(1)} + 0.5);
  vec4 field = fieldAt(root);
  vec4 kind = kindAt(root + (vec2(noiseOf(root * 0.9), noiseOf(root * 0.9 + 9.0)) - 0.5) * 1.5);
  float slope = length(vec2(fieldAt(root + vec2(1.0, 0.0)).r - field.r, fieldAt(root + vec2(0.0, 1.0)).r - field.r));
  float keep = (1.0 - smoothstep(0.3, 0.5, kind.r)) * (1.0 - smoothstep(0.34, 0.56, kind.g))
    * smoothstep(-0.1, -0.3, field.g - field.r) * (1.0 - smoothstep(0.24, 0.4, slope));
  keep *= 1.0 - smoothstep(19.0, 23.5, distance(root, uFocus.xz));
  keep *= 1.0 - uSnow * 0.8;
  keep = step(fract(first * 7.31 + second * 3.17), keep * 0.999);
  float meadow = smoothstep(0.4, 0.6, kind.b);
  float flower = step(0.972, second) * meadow;
  float tall = step(0.975, first) * (1.0 - meadow);
  float height = (0.26 + 0.16 * first + kind.a * 0.08 + meadow * 0.12 + flower * 0.12 + tall * 0.22) * keep;
  float width = (0.05 + 0.035 * second) * (1.0 + flower * 0.9 * step(0.5, aCorner.y) * step(aCorner.y, 0.6));
  float gust = windField(root, 1.0);
  vec2 sway = WIND_HEADING * (0.25 + gust * 0.75) * uWindForce * 0.5
    + vec2(sin(uTime * 1.7 + root.x * 0.8 + first * 4.0), cos(uTime * 1.3 + root.y * 0.7)) * (0.03 + gust * 0.07);
  float bend = aCorner.y * aCorner.y;
  vec3 place = vec3(root.x, field.r, root.y) + vec3(uSide.x, 0.0, uSide.y) * aCorner.x * width;
  place.xz += sway * bend * height * 2.4;
  place.y += aCorner.y * height - length(sway) * bend * height * 0.6;
  float clump = floor(clamp(noiseOf(root * 1.5 + 8.0), 0.0, 0.999) * 3.0) * 0.5;
  vec3 low = turfOf(root, kind) * 0.9 * EXPOSURE;
  vec3 high = low * (1.12 + 0.07 * clump + 0.07 * step(0.55, gust));
  high = mix(high, vec3(0.78, 0.84, 0.48) * EXPOSURE, tall * 0.5);
  vec3 petal = (first < 0.25 ? vec3(1.0, 0.96, 0.9) : first < 0.5 ? vec3(0.98, 0.6, 0.72) : first < 0.75 ? vec3(1.0, 0.84, 0.3) : vec3(0.7, 0.6, 0.95)) * EXPOSURE;
  vec3 up = vec3(0.0, 1.0, 0.0);
  float lit = sunlitAt(vec3(root.x, field.r + 0.1, root.y), up) * (1.0 - 0.4 * cloudOf(root));
  vec3 light = toonLight(uAmbient, uSun, up, lit, 1.0);
  float glow = 0.0;
  for (int index = 0; index < ${LAMPS}; index++) {
    float away = distance(place, uLamps[index].xyz);
    glow += uLamps[index].w / (1.0 + away * away * 0.3);
  }
  light = floor((light + uLamp * min(1.0, glow)) * 12.0 + 0.5) / 12.0;
  light *= mix(vec3(1.0), vec3(0.74, 0.77, 0.85), uWet);
  vLow = low * light;
  vHigh = high * light;
  vPetal = vec4(petal * light, flower);
  vUp = aCorner.y;
  vWorld = place;
  gl_Position = uViewProjection * vec4(place, 1.0);
}`;

export const BLADE_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uFogRange;
uniform vec3 uEye;
${SKY_ROW}
in vec3 vLow;
in vec3 vHigh;
in vec4 vPetal;
in float vUp;
in vec3 vWorld;
layout(location = 0) out vec4 color;
layout(location = 1) out vec4 surface;
void main() {
  vec3 paint = mix(vLow, vHigh, step(0.4, vUp));
  paint = mix(paint, vPetal.rgb, vPetal.a * step(0.46, vUp));
  float fog = smoothstep(uFogRange.x, uFogRange.y, distance(vWorld, uEye));
  color = vec4(mix(paint, skyRow(gl_FragCoord.y / uRows), fog), 1.0);
  surface = vec4(0.5, 1.0, 0.5, 0.0);
}`;

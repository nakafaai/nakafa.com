import { SPAN } from "@repo/backend/confect/island/world";
import { ATLAS_TILES } from "@/lib/island/atlas";
import { SHORE_REACH } from "@/lib/island/shore";
import { WIND_GLSL } from "@/lib/island/wind";

/**
 * The island's GLSL programs (ADR 0047, D2), written for WebGL2. The painter
 * compiles them once; nothing here runs in JavaScript.
 */

/** The chunk program: atlas pixels lit by the sun, shaded where a cloud passes, lit by the sky over them and the lamps beside them, fading into fog. */
export const CHUNK_VERTEX = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aUv;
layout(location = 2) in float aShade;
layout(location = 3) in float aSky;
layout(location = 4) in float aGlow;
layout(location = 5) in float aSway;
uniform mat4 uViewProjection;
${WIND_GLSL}
out vec2 vUv;
out float vShade;
out float vSky;
out float vGlow;
out float vSway;
out vec3 vWorld;
void main() {
  vUv = aUv;
  vShade = aShade;
  vSky = aSky;
  vGlow = aGlow;
  vSway = aSway;
  // The light and the edges keep to where the block stands; only what is drawn gives to the wind (D32).
  vWorld = aPosition;
  vec3 place = aSway > 0.0 ? aPosition + windShift(aPosition.xz, aSway) : aPosition;
  gl_Position = uViewProjection * vec4(place, 1.0);
}`;

export const CHUNK_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uAtlas;
uniform vec3 uSun;
uniform vec3 uAmbient;
uniform vec3 uLamp;
uniform vec3 uFog;
uniform vec2 uFogRange;
uniform float uAlpha;
uniform float uTime;
uniform vec2 uWaterTile;
uniform float uWater;
uniform sampler2D uShore;
uniform vec2 uShoreBox;
uniform vec3 uEye;
uniform float uWet;
uniform float uSnow;
${WIND_GLSL}
in vec2 vUv;
in float vShade;
in float vSky;
in float vGlow;
in float vSway;
in vec3 vWorld;
layout(location = 0) out vec4 color;
layout(location = 1) out vec4 surface;
float hashOf(vec2 cell) {
  return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
}
float noiseOf(vec2 place) {
  vec2 cell = floor(place);
  vec2 part = fract(place);
  part = part * part * (3.0 - 2.0 * part);
  return mix(
    mix(hashOf(cell), hashOf(cell + vec2(1.0, 0.0)), part.x),
    mix(hashOf(cell + vec2(0.0, 1.0)), hashOf(cell + vec2(1.0, 1.0)), part.x),
    part.y
  );
}
// The shadow of the clouds drifting over the island, cut into whole art pixels.
float cloudOf(vec2 place) {
  vec2 pixel = floor((place + vec2(uTime * 0.7, uTime * 0.3)) * 4.0) / 4.0;
  float cover = noiseOf(pixel / 15.0) * 0.7 + noiseOf(pixel / 6.0) * 0.3;
  return step(0.6, cover);
}
void main() {
  vec2 uv = vUv;
  if (uWater > 0.5) {
    vec2 local = fract(vWorld.xz * 0.5 + vec2(uTime * 0.04, uTime * 0.017) + vWorld.y * 0.5);
    uv = (uWaterTile + 0.002 + local * 0.996) / ${ATLAS_TILES.toFixed(1)};
  }
  vec4 texel = texture(uAtlas, uv);
  if (texel.a < 0.5) discard;
  vec3 paint = texel.rgb;
  if (vSway < -0.5) {
    // A gust shows on the meadow (D32): the grass under its front turns a tone lighter, in whole art pixels.
    paint *= 1.0 + 0.1 * step(0.55, windField(floor(vWorld.xz * 16.0) / 16.0, 1.0));
  }
  vec3 face = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (uWater < 0.5) {
    // What the weather left (D33), only where the sky reaches: wet ground darkens and cools, the tops of things more than their sides.
    float open = smoothstep(0.6, 0.95, vSky);
    float wet = uWet * open * (face.y > 0.5 ? 1.0 : 0.55);
    paint = mix(paint, paint * vec3(0.74, 0.77, 0.85), wet);
    // Snow settles art pixel by art pixel on what faces the sky, the first patches where it lies thickest.
    vec2 grain = floor(vWorld.xz * 16.0);
    float lying = uSnow * open * step(0.5, face.y);
    // Drifts first, then whole fields: soft patches a few cells wide, their edges ragged by a pixel or two.
    float spread = noiseOf(grain / 40.0) * 0.6 + noiseOf(grain / 9.0) * 0.28 + hashOf(grain) * 0.12;
    paint = mix(paint, vec3(0.92, 0.95, 1.0), step(spread, lying) * 0.94);
  }
  float foam = 0.0;
  if (uWater > 0.5) {
    // The sea in whole art pixels (D28, D34): how far this pixel lies from the land's edge, in cells, wobbled by a still noise of its place so no band copies the coast's steps.
    vec2 art = floor(vWorld.xz * 16.0) / 16.0;
    float coast = texture(uShore, (art + 0.5 - uShoreBox.x) / uShoreBox.y).r * ${SHORE_REACH.toFixed(1)} - 0.5;
    coast += (noiseOf(art * 0.7) - 0.5) * 0.8;
    float drift = noiseOf(art * 2.0 + vec2(uTime * 0.25, -uTime * 0.18));
    // Depth in four bands, each a flat step of colour: shoal, shallows, the shelf, then the deep.
    vec3 tint = coast < 0.8 ? vec3(0.1, 0.3, 0.24) : coast < 2.4 ? vec3(0.05, 0.17, 0.14) : coast < 5.5 ? vec3(0.015, 0.06, 0.05) : vec3(0.0);
    paint = paint + tint * 0.8;
    // Waves: thin crests that roll in toward the coast from the shelf, broken where the noise is low, and gone in the shoal.
    float crest = step(fract((coast + uTime * 0.55) / 2.6), 0.07) * step(0.9, coast) * (1.0 - step(7.0, coast));
    float wave = crest * step(0.4, noiseOf(art * 0.9 + vec2(uTime * 0.05, 0.0)));
    // Surf: foam that laps up and back against the land, and one line riding in ahead of it.
    float lap = 0.5 + 0.5 * sin(uTime * 1.1 + drift * 5.0);
    float surf = step(coast, 0.12 + 0.28 * lap);
    float line = step(abs(coast - (0.7 + 0.25 * lap)), 0.05) * step(0.35, lap);
    // Glints: out at sea, patches of sparse specks of light that run with the wind.
    float glint = step(0.955, noiseOf(vec2(art.x * 3.0 + uTime * 0.7, art.y * 9.0 - uTime * 0.2))) * step(0.5, noiseOf(art * 0.12 + vec2(uTime * 0.03, 0.0))) * smoothstep(4.0, 7.0, coast) * vSky;
    foam = max(max(surf, line * 0.85), max(wave * 0.45, glint * 0.55));
  }
  vec3 light = uAmbient * (0.55 + 0.45 * vShade) + uSun * vShade * vSky * (1.0 - 0.4 * cloudOf(vWorld.xz));
  light = max(light, uLamp * vGlow * vGlow * vShade);
  light = floor(light * 12.0 + 0.5) / 12.0;
  // Measured per pixel: the sea is a few huge quads, and a distance blended between their far corners would fog all of it.
  float fog = smoothstep(uFogRange.x, uFogRange.y, distance(vWorld, uEye));
  vec3 lit = mix(paint * light, vec3(0.97, 0.99, 1.0) * min(vec3(1.0), light + 0.12), foam);
  color = vec4(mix(lit, uFog, fog), mix(uAlpha, 1.0, foam));
  // The face's own direction, from how the world moves across this pixel, for the edge pass (D20).
  surface = vec4(face * 0.5 + 0.5, 1.0);
}`;

/** One triangle over the whole frame, for the passes that paint every pixel. */
const FULL_FRAME = `#version 300 es
out vec2 vUv;
out float vHeight;
void main() {
  vec2 corner = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  vUv = corner * 0.5 + 0.5;
  vHeight = vUv.y;
  gl_Position = vec4(corner, 1.0, 1.0);
}`;

/** The sky program: one triangle over the whole screen, from the zenith's color to the horizon's. */
export const SKY_VERTEX = FULL_FRAME;

export const SKY_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec3 uZenith;
uniform vec3 uHorizon;
in float vHeight;
layout(location = 0) out vec4 color;
void main() {
  float t = clamp(vHeight * 1.4 - 0.2, 0.0, 1.0);
  color = vec4(mix(uHorizon, uZenith, floor(t * 10.0) / 10.0), 1.0);
}`;

/**
 * The weather program (ADR 0047, D33): rain as short streaks and snow as
 * flakes, each falling along the wind until it meets the first thing over its
 * column (the roof map, `lib/island/cover.ts`), so a roof keeps the ground
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
uniform sampler2D uRoof;
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
  float code = floor(texelFetch(uRoof, ivec2(cell), 0).r * 255.0 + 0.5);
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

/** The outline program: the twelve edges of the cell a press would change, drawn over everything. */
export const OUTLINE_VERTEX = `#version 300 es
layout(location = 0) in vec3 aCorner;
uniform mat4 uViewProjection;
uniform vec3 uCell;
void main() {
  gl_Position = uViewProjection * vec4(uCell - 0.01 + aCorner * 1.02, 1.0);
}`;

export const OUTLINE_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec4 uColor;
out vec4 color;
void main() {
  color = uColor;
}`;

/**
 * The edge pass (ADR 0047, D20): it reads the frame's colors, the direction of
 * each pixel's face and its depth, and draws a dark outline one art pixel wide
 * on the near side of every silhouette and a light line along every edge where
 * a top meets a side, so each body reads at a glance from any angle. Nothing
 * under the sea's surface is edged. A depth
 * step counts as an edge only past what the face's own slant explains, so a
 * long slope seen edge-on stays clean.
 */
export const EDGE_VERTEX = FULL_FRAME;

export const EDGE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uColor;
uniform sampler2D uSurface;
uniform sampler2D uDepth;
uniform vec2 uTexel;
uniform vec2 uClip;
uniform vec3 uAhead;
uniform mat4 uInverse;
uniform float uSea;
in vec2 vUv;
out vec4 color;
float depthAt(vec2 at) {
  float z = texture(uDepth, at).r * 2.0 - 1.0;
  return (2.0 * uClip.x * uClip.y) / (uClip.y + uClip.x - z * (uClip.y - uClip.x));
}
vec3 normalAt(vec2 at) {
  return texture(uSurface, at).xyz * 2.0 - 1.0;
}
void main() {
  vec4 base = texture(uColor, vUv);
  if (texture(uDepth, vUv).r >= 1.0) {
    color = base;
    return;
  }
  // Under the sea the water already softens every edge, and the sea floor's own seams must not show through.
  vec4 world = uInverse * vec4(vUv * 2.0 - 1.0, texture(uDepth, vUv).r * 2.0 - 1.0, 1.0);
  if (world.y / world.w < uSea) {
    color = base;
    return;
  }
  float depth = depthAt(vUv);
  vec3 normal = normalAt(vUv);
  float step = 0.2 + depth * 0.014 / max(0.2, abs(dot(normal, uAhead)));
  float outline = 0.0;
  float crease = 0.0;
  vec2 sides[4] = vec2[4](vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0));
  for (int index = 0; index < 4; index++) {
    vec2 at = vUv + sides[index] * uTexel;
    float beside = depthAt(at);
    if (beside - depth > step) {
      outline = 1.0;
    } else if (abs(beside - depth) < step) {
      vec3 other = normalAt(at);
      if (dot(normal, other) < 0.8 && normal.y > other.y + 0.3) {
        crease = 1.0;
      }
    }
  }
  vec3 lit = base.rgb * (1.0 - 0.5 * outline);
  color = vec4(mix(lit, min(lit * 1.25 + 0.03, vec3(1.0)), crease * (1.0 - outline)), 1.0);
}`;

/**
 * The body program (ADR 0047, D21): every true 3D model of one kind at once,
 * each body placed, turned to face its way and bobbing as it walks from its
 * own numbers. Faces are lit flat by the sun from the upper left and the sky,
 * in the same few steps of light as the blocks, and write their direction for
 * the edge pass, so every body is outlined as crisply as a house. A shadow
 * pass draws the same kind flattened to a dark disc on the ground.
 */
export const BODY_VERTEX = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aColor;
layout(location = 3) in vec4 aPlace;
layout(location = 4) in float aMove;
layout(location = 5) in float aGround;
uniform mat4 uViewProjection;
uniform float uTime;
uniform float uShadow;
${WIND_GLSL}
out vec3 vColor;
out vec3 vNormal;
out vec3 vWorld;
void main() {
  float c = cos(aPlace.w);
  float s = sin(aPlace.w);
  vec3 local = aPosition;
  vec3 base = aPlace.xyz;
  if (uShadow > 0.5) {
    // A shadow is the body pressed flat onto the ground under it, a hair above so it never fights it.
    local = vec3(local.x * 0.9, 0.03, local.z * 0.9);
    base = vec3(aPlace.x, aGround, aPlace.z);
  }
  vec3 turned = vec3(local.x * c + local.z * s, local.y, -local.x * s + local.z * c);
  vec3 place = base + turned;
  if (aMove < 0.0) {
    // A plant gives to the wind like a rod held at its foot (D32): hardly at all low down, most at its top, a tall one further than a small one. Its shadow follows on the ground.
    float height = min(1.0, aPosition.y * -aMove);
    vec3 shift = windShift(aPlace.xz, height * height * min(1.0, 0.4 - 0.2 / aMove));
    place += uShadow > 0.5 ? vec3(shift.x, 0.0, shift.z) : shift;
  }
  place.y += abs(sin(uTime * 9.0 + aPlace.x * 3.1)) * max(aMove, 0.0) * (1.0 - uShadow);
  vNormal = vec3(aNormal.x * c + aNormal.z * s, aNormal.y, -aNormal.x * s + aNormal.z * c);
  vColor = aColor;
  vWorld = place;
  gl_Position = uViewProjection * vec4(place, 1.0);
  if (uShadow > 0.5 && aGround < 0.0) {
    // A body in the water or over it casts no shadow: its triangles fall outside the frame.
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
}`;

export const BODY_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 uSun;
uniform vec3 uAmbient;
uniform vec3 uFog;
uniform vec2 uFogRange;
uniform vec3 uEye;
uniform float uShadow;
in vec3 vColor;
in vec3 vNormal;
in vec3 vWorld;
layout(location = 0) out vec4 color;
layout(location = 1) out vec4 surface;
void main() {
  vec3 normal = normalize(vNormal);
  if (uShadow > 0.5) {
    color = vec4(0.0, 0.0, 0.0, 0.28);
    surface = vec4(0.5, 1.0, 0.5, 1.0);
    return;
  }
  float facing = max(dot(normal, normalize(vec3(-0.45, 0.8, 0.4))), 0.0);
  float shade = 0.62 + 0.38 * max(normal.y, 0.0);
  vec3 light = uAmbient * shade + uSun * facing;
  light = floor(light * 6.0 + 0.5) / 6.0;
  float fog = smoothstep(uFogRange.x, uFogRange.y, distance(vWorld, uEye));
  color = vec4(mix(vColor * light, uFog, fog), 1.0);
  surface = vec4(normal * 0.5 + 0.5, 1.0);
}`;

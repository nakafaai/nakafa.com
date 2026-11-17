import { ATLAS_TILES, SLOTS } from "@/lib/island/atlas";
import { GROUND_GLSL } from "@/lib/island/ground";
import { FOLIAGE } from "@/lib/island/mesh";
import { TOON_GLSL } from "@/lib/island/toon";
import { WATER_GLSL } from "@/lib/island/water";
import { WIND_GLSL } from "@/lib/island/wind";

/**
 * The island's GLSL programs (ADR 0047, D2), written for WebGL2. The painter
 * compiles them once; nothing here runs in JavaScript.
 */

/**
 * The sky's color on a row of the frame, from 0 at its foot to 1 at its top,
 * in the sky's own ten steps (D35): what a far pixel fades toward, so far
 * land meets the sky behind it on the same row with no seam.
 */
const SKY_ROW = `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform float uRows;
vec3 skyRow(float height) {
  float t = clamp(height * 1.4 - 0.2, 0.0, 1.0);
  return mix(uHorizon, uZenith, floor(t * 10.0) / 10.0);
}`;

/** The chunk program: atlas pixels lit by the sun in toon bands where its shadow map lets it reach, shaded where a cloud passes, lit by the sky over them and the lamps beside them, dimmed and laced with caustics under the sea, fading into fog. */
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
out vec3 vWorld;
void main() {
  vUv = aUv;
  vShade = aShade;
  vSky = aSky;
  vGlow = aGlow;
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
uniform vec2 uFogRange;
uniform float uTime;
uniform float uSea;
uniform vec2 uWaterTile;
const vec2 GLASS_TILE = vec2(${(SLOTS.glass % ATLAS_TILES).toFixed(1)}, ${Math.floor(SLOTS.glass / ATLAS_TILES).toFixed(1)});
uniform float uWater;
uniform vec3 uEye;
${SKY_ROW}
uniform float uWet;
uniform float uSnow;
${WIND_GLSL}
in vec2 vUv;
in float vShade;
in float vSky;
in float vGlow;
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
${GROUND_GLSL}
${TOON_GLSL}
${WATER_GLSL}
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
  // A ground top (D39) draws each art pixel from the ground the column map gives it, in the same tile of that ground's set, darkened where a higher ground's edge stands beside it toward the sun, and along its own edge away from it.
  float slot = dot(floor(vUv * ${ATLAS_TILES.toFixed(1)}), vec2(1.0, ${ATLAS_TILES.toFixed(1)}));
  float ground = uWater > 0.5 ? 0.0 : groundOfSlot(slot);
  float border = 0.0;
  if (ground > 0.0) {
    float pixel = 1.0 / 16.0;
    vec2 art = (floor(vWorld.xz * 16.0) + 0.5) * pixel;
    float top = floor(vWorld.y + 0.5) - 1.0;
    float own = ground;
    ground = groundAt(art, top, own);
    float sunward = max(groundAt(art - vec2(pixel, 0.0), top, own), groundAt(art + vec2(0.0, pixel), top, own));
    float shadeward = min(groundAt(art + vec2(pixel, 0.0), top, own), groundAt(art - vec2(0.0, pixel), top, own));
    border = 0.22 * step(ground + 0.5, sunward) + 0.12 * step(shadeward + 0.5, ground);
    float tile = GROUND_SLOT + (ground - 1.0) * WANG + mod(slot - GROUND_SLOT, WANG);
    uv = (vec2(mod(tile, ${ATLAS_TILES.toFixed(1)}), floor(tile / ${ATLAS_TILES.toFixed(1)})) + fract(vUv * ${ATLAS_TILES.toFixed(1)})) / ${ATLAS_TILES.toFixed(1)};
  }
  vec4 texel = texture(uAtlas, uv);
  // After dusk a window's clear panes glow warm instead of showing through (D36); most homes are lit, a few stay dark.
  float pane = uWater < 0.5 && all(equal(floor(vUv * ${ATLAS_TILES.toFixed(1)}), GLASS_TILE)) ? 1.0 : 0.0;
  float home = hashOf(floor(vWorld.xz) + floor(vWorld.y) * 7.0);
  float emit = 0.0;
  if (texel.a < 0.5) {
    if (pane * step(0.3, uLamp.r) * step(home, 0.8) < 0.5) discard;
    emit = smoothstep(0.3, 0.7, uLamp.r);
  }
  vec3 paint = texel.rgb * (1.0 - border);
  if (abs(ground - GRASS) < 0.5) {
    vec2 art = floor(vWorld.xz * 16.0) / 16.0;
    // The meadow in patches a few blocks wide, a shade darker or lighter, so a field never reads as one flat green (D39).
    float meadow = noiseOf(art * 0.2);
    paint *= 1.0 + 0.06 * (step(0.66, meadow) - step(meadow, 0.32));
    // A gust shows on the meadow (D32): the grass under its front turns a tone lighter, in whole art pixels.
    paint *= 1.0 + 0.1 * step(0.55, windField(art, 1.0));
  }
  vec3 face = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if (uWater < 0.5 && ground < 0.5) {
    // Each face of each block a shade lighter or darker than its neighbours (D44), so a wall of one block never reads as one flat sheet.
    vec3 cell = floor(vWorld - face * 0.01);
    paint *= 1.0 + 0.05 * (hashOf(cell.xz + cell.y * 17.0 + face.xz * 3.1 + face.y * 7.3) - 0.5);
  }
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
  float alpha = 1.0;
  if (uWater > 0.5) {
    vec4 water = waterOf(vWorld, uEye, uToward, uTime, vSky, foam);
    paint = water.rgb * (0.9 + 0.2 * dot(texel.rgb, vec3(0.333)));
    alpha = water.a;
    if (abs(face.y) < 0.5) {
      // A wall of water is a fall (D52): white streaks pour down it in whole art pixels, a few broad ones and many thin.
      vec2 sheet = floor(vec2(vWorld.x + vWorld.z, vWorld.y) * 16.0);
      float pour = noiseOf(vec2(sheet.x * 0.55, (sheet.y + uTime * 44.0) * 0.09));
      float streak = step(0.58, pour) + step(0.8, hashOf(vec2(sheet.x, floor((sheet.y + uTime * 60.0) * 0.25)))) * 0.6;
      paint = mix(vec3(0.46, 0.74, 0.88), vec3(0.94, 0.98, 1.0), min(1.0, streak));
      alpha = 0.9;
      foam = max(foam, min(1.0, streak) * 0.55);
    }
  }
  // The sun reaches a face only where nothing stands between them, and a cloud passing over dims it; the sky over a face lets it in at all.
  // A plant's or a tuft's thin plane takes the light from above, like the ground it grows on (D44).
  vec3 lighted = abs(vShade - ${FOLIAGE.toFixed(2)}) < 0.001 ? vec3(0.0, 1.0, 0.0) : face;
  float lit = sunlitAt(vWorld, lighted) * vSky * (1.0 - 0.4 * cloudOf(vWorld.xz));
  vec3 light = toonLight(uAmbient, uSun, lighted, lit, 0.55 + 0.45 * vShade);
  light = max(light, uLamp * vGlow * vGlow * vShade);
  // Under the sea the light fades with depth, and the swell's caustics play over the floor in whole art pixels.
  float under = uSea - vWorld.y;
  if (uWater < 0.5 && under > 0.0) {
    vec2 bed = floor(vWorld.xz * 16.0) / 16.0;
    float a = noiseOf(bed * 1.7 + vec2(uTime * 0.5, uTime * 0.3));
    float b = noiseOf(bed * 2.3 - vec2(uTime * 0.4, -uTime * 0.35));
    float caustic = step(abs(a - b), 0.05) * exp(-0.3 * under) * vSky;
    light = light * mix(1.0, 0.5, 1.0 - exp(-0.3 * under)) + uSun * caustic * 0.7;
  }
  light = floor(light * 12.0 + 0.5) / 12.0;
  // Measured per pixel: the sea is a few huge quads, and a distance blended between their far corners would fog all of it.
  float fog = smoothstep(uFogRange.x, uFogRange.y, distance(vWorld, uEye));
  vec3 shown = mix(paint * light, vec3(0.97, 0.99, 1.0) * min(vec3(1.0), light + 0.12), foam);
  shown = mix(shown, vec3(1.0, 0.8, 0.46) * (0.82 + 0.18 * home), emit);
  color = vec4(mix(shown, skyRow(gl_FragCoord.y / uRows), fog), mix(alpha, 1.0, foam));
  // The face's own direction, from how the world moves across this pixel, for the edge pass (D20).
  // Which part this pixel belongs to (D44): each tile its own, so the edge pass rules a line where two materials meet on one plane; the ground blends, so it has none.
  float part = ground > 0.5 ? 0.0 : (mod(slot * 37.0, 254.0) + 1.0) / 255.0;
  surface = vec4(face * 0.5 + 0.5, part);
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
${SKY_ROW}
in float vHeight;
layout(location = 0) out vec4 color;
void main() {
  color = vec4(skyRow(vHeight), 1.0);
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
  float seam = 0.0;
  float part = texture(uSurface, vUv).a;
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
      // Where two parts meet on one plane, the line falls on the lower one's side only, one art pixel wide.
      float otherPart = texture(uSurface, at).a;
      if (part > 0.0 && otherPart > 0.0 && part < otherPart - 0.002 && dot(normal, other) > 0.8) {
        seam = 1.0;
      }
    }
  }
  vec3 lit = base.rgb * (1.0 - 0.5 * outline) * (1.0 - 0.22 * seam * (1.0 - outline));
  color = vec4(mix(lit, min(lit * 1.25 + 0.03, vec3(1.0)), crease * (1.0 - outline)), 1.0);
}`;

/**
 * The body program (ADR 0047, D21): every true 3D model of one kind at once,
 * each body placed, turned to face its way and bobbing as it walks from its
 * own numbers, its parts swimming, striding and flapping by the motion baked
 * into its corners (D48). Faces are lit by the sun in the blocks' toon bands where the
 * shadow map lets it reach, and write their direction for the edge pass, so
 * every body is outlined as crisply as a house. Drawn from the sun's own view,
 * the same program casts each body's shadow into the shadow map (D43).
 */
export const BODY_VERTEX = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aColor;
layout(location = 3) in vec4 aPlace;
layout(location = 4) in float aMove;
layout(location = 5) in vec4 aRig;
layout(location = 6) in float aPitch;
uniform mat4 uViewProjection;
uniform float uTime;
${WIND_GLSL}
out vec3 vColor;
out vec3 vNormal;
out vec3 vWorld;
out vec3 vLocal;
void main() {
  vLocal = aPosition;
  float c = cos(aPlace.w);
  float s = sin(aPlace.w);
  vec3 local = aPosition;
  // The body's own motion (D48 and D49): a swim wave across or up and down it, a leg or an arm striding while it walks, a wing or a flipper flapping, a walking spine flexing, a stalk leaning in the current, each body a little out of step with its neighbours.
  float beat = aRig.x * sin(uTime * aRig.z + aRig.y + aPlace.x * 1.7 + aPlace.z * 0.9);
  float walking = step(0.001, aMove);
  local += aRig.w < 0.5 ? vec3(0.0)
    : aRig.w < 1.5 ? vec3(beat, 0.0, 0.0)
    : aRig.w < 2.5 ? vec3(0.0, beat, 0.0)
    : aRig.w < 3.5 ? vec3(0.0, 0.0, beat * walking)
    : aRig.w < 4.5 ? vec3(0.0, beat, 0.0)
    : aRig.w < 5.5 ? vec3(beat * walking, 0.0, 0.0)
    : vec3(beat * 0.6, 0.0, beat);
  // A body tips its nose up or down before it turns (D50): a whale rising to breach, a dolphin arcing through its leap.
  float pc = cos(aPitch);
  float ps = sin(aPitch);
  local = vec3(local.x, local.y * pc + local.z * ps, local.z * pc - local.y * ps);
  vec3 normal = vec3(aNormal.x, aNormal.y * pc + aNormal.z * ps, aNormal.z * pc - aNormal.y * ps);
  vec3 turned = vec3(local.x * c + local.z * s, local.y, -local.x * s + local.z * c);
  vec3 place = aPlace.xyz + turned;
  if (aMove < 0.0) {
    // A plant gives to the wind like a rod held at its foot (D32): hardly at all low down, most at its top, a tall one further than a small one. Its shadow sways with it.
    float height = min(1.0, aPosition.y * -aMove);
    place += windShift(aPlace.xz, height * height * min(1.0, 0.4 - 0.2 / aMove));
  }
  place.y += abs(sin(uTime * 9.0 + aPlace.x * 3.1)) * max(aMove, 0.0);
  vNormal = vec3(normal.x * c + normal.z * s, normal.y, -normal.x * s + normal.z * c);
  vColor = aColor;
  vWorld = place;
  gl_Position = uViewProjection * vec4(place, 1.0);
}`;

export const BODY_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 uSun;
uniform vec3 uAmbient;
${SKY_ROW}
uniform vec2 uFogRange;
uniform vec3 uEye;
uniform float uSeen;
${TOON_GLSL}
in vec3 vColor;
in vec3 vNormal;
in vec3 vWorld;
in vec3 vLocal;
layout(location = 0) out vec4 color;
layout(location = 1) out vec4 surface;
float hashOf(vec3 cell) {
  return fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
void main() {
  vec3 normal = normalize(vNormal);
  if (uSeen > 0.5) {
    // Seen through a wall or a crown (D38): every other art pixel in a deep warm ink, which reads on a pale wall, a red roof and a crown alike.
    if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) > 0.5) discard;
    color = vec4(mix(vec3(0.16, 0.1, 0.08), vColor, 0.15), 0.88);
    return;
  }
  vec3 light = toonLight(uAmbient, uSun, normal, sunlitAt(vWorld, normal), 0.62 + 0.38 * max(normal.y, 0.0));
  light = floor(light * 8.0 + 0.5) / 8.0;
  float fog = smoothstep(uFogRange.x, uFogRange.y, distance(vWorld, uEye));
  // A speckle held to the body's own art pixels (D44), a tone up or down on one in five, so a hide or a coat is never a flat fill and never crawls as the body walks.
  float grain = hashOf(floor(vLocal * 16.0));
  vec3 paint = vColor * (1.0 + 0.08 * (step(0.82, grain) - step(grain, 0.18)));
  color = vec4(mix(paint * light, skyRow(gl_FragCoord.y / uRows), fog), 1.0);
  // Each colored part its own, so the edge pass rules a line between an eye and a face, a wing and a body (D44).
  surface = vec4(normal * 0.5 + 0.5, 0.5 + 0.49 * fract(dot(vColor, vec3(17.13, 59.71, 113.37))));
}`;

/**
 * The cast program (ADR 0047, D43): the blocks seen from the sun, depth only,
 * into the shadow map. A clear atlas pixel casts nothing, so a crown's gaps
 * let the light through in flecks.
 */
export const CAST_VERTEX = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aUv;
uniform mat4 uViewProjection;
out vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = uViewProjection * vec4(aPosition, 1.0);
}`;

export const CAST_FRAGMENT = `#version 300 es
precision mediump float;
uniform sampler2D uAtlas;
in vec2 vUv;
out vec4 color;
void main() {
  if (texture(uAtlas, vUv).a < 0.5) {
    discard;
  }
  color = vec4(1.0);
}`;

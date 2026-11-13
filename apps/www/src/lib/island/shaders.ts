import { ATLAS_TILES } from "@/lib/island/atlas";

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
uniform mat4 uViewProjection;
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
  vWorld = aPosition;
  gl_Position = uViewProjection * vec4(aPosition, 1.0);
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
uniform vec3 uEye;
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
  vec3 light = uAmbient * (0.55 + 0.45 * vShade) + uSun * vShade * vSky * (1.0 - 0.4 * cloudOf(vWorld.xz));
  light = max(light, uLamp * vGlow * vGlow * vShade);
  light = floor(light * 12.0 + 0.5) / 12.0;
  // Measured per pixel: the sea is a few huge quads, and a distance blended between their far corners would fog all of it.
  float fog = smoothstep(uFogRange.x, uFogRange.y, distance(vWorld, uEye));
  color = vec4(mix(texel.rgb * light, uFog, fog), uAlpha);
  // The face's own direction, from how the world moves across this pixel, for the edge pass (D20).
  surface = vec4(normalize(cross(dFdx(vWorld), dFdy(vWorld))) * 0.5 + 0.5, 1.0);
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
 * The weather program: rain as short slanted streaks and snow as single flakes,
 * falling through a box of sky around the camera's target. Each particle is a
 * seed; its place at any moment comes from the time, so nothing is uploaded
 * while it falls.
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
out float vTail;
void main() {
  vTail = aTail;
  float height = 18.0;
  float fall = mod(aSeed.z * height + uTime * uSpeed, height);
  vec3 position = vec3(
    uTarget.x + (aSeed.x - 0.5) * 56.0 + sin(uTime * 0.8 + aSeed.z * 20.0) * uSway,
    uTarget.y + 16.0 - fall + aTail * uLength,
    uTarget.z + (aSeed.y - 0.5) * 56.0
  );
  position.x += aTail * uLength * 0.25;
  gl_Position = uViewProjection * vec4(position, 1.0);
  gl_PointSize = 2.0;
}`;

export const WEATHER_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec4 uColor;
in float vTail;
out vec4 color;
void main() {
  // A drop is brightest at its head and fades along its tail.
  color = vec4(uColor.rgb, uColor.a * (1.0 - vTail * 0.75));
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
layout(location = 4) in float aBob;
layout(location = 5) in float aGround;
uniform mat4 uViewProjection;
uniform float uTime;
uniform float uShadow;
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
  place.y += abs(sin(uTime * 9.0 + aPlace.x * 3.1)) * aBob * (1.0 - uShadow);
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

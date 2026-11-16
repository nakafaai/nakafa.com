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
out vec4 color;
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
}`;

/** The sky program: one triangle over the whole screen, from the zenith's color to the horizon's. */
export const SKY_VERTEX = `#version 300 es
out float vHeight;
void main() {
  vec2 corner = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  vHeight = corner.y * 0.5 + 0.5;
  gl_Position = vec4(corner, 1.0, 1.0);
}`;

export const SKY_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec3 uZenith;
uniform vec3 uHorizon;
in float vHeight;
out vec4 color;
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

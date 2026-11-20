import { LAND_GLSL } from "@/lib/island/land/glsl";
import { WIND_GLSL } from "@/lib/island/wind";

/**
 * The GLSL programs of what flutters over the land by day (ADR 0047, D41):
 * the leaves the crowns let go and the butterflies over the meadow. Both take
 * their places from the time alone and work at any place of the land.
 */

/**
 * The leaf program (ADR 0047, D41): leaves letting go of the crowns. Each
 * crown sheds by the season's share, picked by its place; a leaf falls from a
 * new spot of the crown each round, tumbles as it falls, two art pixels wide
 * face on and one edge on, drifts with the wind, and lies on the ground or
 * the water it drifted to, read from the window of land, until its round
 * ends. `aCrown` is one crown a point, four numbers each: the place under
 * the crown a leaf lets go from, x, y, z in blocks, then the height of the
 * ground under the tree, which tells how long the leaf drifts.
 */
export const LEAF_VERTEX = `#version 300 es
layout(location = 0) in vec4 aCrown;
uniform mat4 uViewProjection;
uniform float uTime;
uniform float uShare;
${WIND_GLSL}
${LAND_GLSL}
out float vFace;
out float vAlpha;
const float FALL = 0.55;
// What a leaf comes to rest on at a place: the higher of the ground and the water's face.
float floorAt(vec2 at) {
  vec4 field = fieldAt(at);
  return max(field.r, field.g);
}
void main() {
  float seed = fract(sin(dot(aCrown.xz + aCrown.y * 3.1, vec2(12.9898, 78.233))) * 43758.5453);
  if (seed >= uShare) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float life = 9.0 + seed * 6.0;
  float cycle = uTime / life + seed * 7.0;
  float age = fract(cycle);
  float lap = floor(cycle);
  vec2 start = aCrown.xz + (vec2(fract(sin(lap * 12.3 + seed * 91.0) * 437.5), fract(sin(lap * 7.1 + seed * 33.0) * 912.3)) - 0.5) * 0.9;
  // The wind carries a leaf for as long as it would fall to the ground under its own tree, and it stops fluttering there.
  float drop = max(0.0, aCrown.y - aCrown.w);
  float fallen = min(age * life * FALL, drop);
  vec2 drift = WIND_HEADING * (0.35 * uWindForce + 0.6 * windField(start, 1.0)) * fallen * 0.8;
  vec2 flutter = vec2(sin(uTime * 2.3 + seed * 40.0), cos(uTime * 1.7 + seed * 23.0)) * 0.25 * (fallen >= drop ? 0.0 : 1.0);
  vec2 at = start + drift + flutter;
  float rest = floorAt(at) + 0.04;
  float y = max(aCrown.y - age * life * FALL, rest);
  bool lying = y <= rest;
  vFace = lying ? 1.0 : step(0.0, sin(uTime * 7.0 + seed * 50.0));
  // A leaf shows as it leaves the crown and fades at the end of its round on the ground.
  vAlpha = smoothstep(0.0, 0.03, age) * (1.0 - smoothstep(0.85, 1.0, age));
  gl_Position = uViewProjection * vec4(at.x, y, at.y, 1.0);
  gl_PointSize = vFace > 0.5 ? 2.0 : 1.0;
}`;

export const LEAF_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec3 uLeaf;
uniform vec3 uLight;
in float vFace;
in float vAlpha;
out vec4 color;
void main() {
  // The leaf's back, seen as it tumbles, is a shade darker than its face.
  color = vec4(uLeaf * uLight * (vFace > 0.5 ? 1.0 : 0.72), vAlpha);
}`;

/**
 * The butterfly program (ADR 0047, D41): by day a butterfly loops over its
 * flower, beating its wings, open three art pixels wide around a dark body and
 * shut to one, and every so often settles on the flower and opens them slowly.
 * Each takes one of three colors by its place: cream, butter yellow, sky blue.
 * `aFlower` is one butterfly a point, three numbers each: the place it
 * settles, x, y, z in blocks, about the height of a flower over the ground.
 */
export const BUTTERFLY_VERTEX = `#version 300 es
layout(location = 0) in vec3 aFlower;
uniform mat4 uViewProjection;
uniform float uTime;
out vec3 vColor;
out float vOpen;
void main() {
  float seed = fract(sin(dot(aFlower.xz + aFlower.y * 1.7, vec2(12.9898, 78.233))) * 43758.5453);
  float turn = uTime * (0.6 + 0.3 * seed) + seed * 30.0;
  float resting = step(0.72, fract(uTime / (9.0 + seed * 5.0) + seed));
  vec3 loop = vec3(cos(turn) * 0.9 + sin(turn * 0.37) * 0.4, 0.7 + 0.45 * sin(turn * 1.3 + seed * 5.0), sin(turn * 0.8) * 0.9);
  vec3 at = aFlower + mix(loop, vec3(0.0, 0.12, 0.0), resting);
  vOpen = resting > 0.5 ? step(0.45, fract(uTime * 0.6 + seed)) : step(0.0, sin(uTime * 28.0 + seed * 60.0));
  vColor = seed < 0.34 ? vec3(0.98, 0.95, 0.86) : seed < 0.67 ? vec3(0.99, 0.86, 0.36) : vec3(0.52, 0.76, 0.98);
  gl_Position = uViewProjection * vec4(at, 1.0);
  gl_PointSize = vOpen > 0.5 ? 3.0 : 1.0;
}`;

export const BUTTERFLY_FRAGMENT = `#version 300 es
precision mediump float;
uniform vec3 uLight;
in vec3 vColor;
in float vOpen;
out vec4 color;
void main() {
  // Open wings: a dark body down the middle column; shut: the wing's edge alone.
  float body = vOpen > 0.5 && floor(gl_PointCoord.x * 3.0) == 1.0 ? 1.0 : 0.0;
  color = vec4(mix(vColor, vec3(0.16, 0.11, 0.09), body) * uLight, 1.0);
}`;

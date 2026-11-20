import { TOON_GLSL } from "@/lib/island/toon";
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
export const SKY_ROW = `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform float uRows;
vec3 skyRow(float height) {
  float t = clamp(height * 1.4 - 0.2, 0.0, 1.0);
  return mix(uHorizon, uZenith, floor(t * 10.0) / 10.0);
}`;

/** A number from 0 to 1 that a cell always gives, and that number blended smoothly between the cells: the grain every ground pass paints with. */
export const NOISE_GLSL = `
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
uniform vec2 uFade;
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
  // The air that hides the far land hides its lines with it, so no line is left standing in the sky.
  float near = 1.0 - smoothstep(uFade.x, uFade.y, depth);
  vec3 lit = base.rgb * (1.0 - 0.5 * outline * near) * (1.0 - 0.22 * seam * (1.0 - outline) * near);
  color = vec4(mix(lit, min(lit * 1.25 + 0.03, vec3(1.0)), crease * (1.0 - outline) * near), 1.0);
}`;

/**
 * The body program (ADR 0047, D21): every true 3D model of one kind at once,
 * each body placed, turned to face its way and bobbing as it walks from its
 * own numbers, its parts swimming, striding and flapping by the motion baked
 * into its corners (D48). Faces are lit by the sun in the land's toon bands where the
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
  bool spins = aRig.w > 6.5;
  float beat = spins ? 0.0 : aRig.x * sin(uTime * aRig.z + aRig.y + aPlace.x * 1.7 + aPlace.z * 0.9);
  float walking = step(0.001, aMove);
  local += aRig.w < 0.5 ? vec3(0.0)
    : aRig.w < 1.5 ? vec3(beat, 0.0, 0.0)
    : aRig.w < 2.5 ? vec3(0.0, beat, 0.0)
    : aRig.w < 3.5 ? vec3(0.0, 0.0, beat * walking)
    : aRig.w < 4.5 ? vec3(0.0, beat, 0.0)
    : aRig.w < 5.5 ? vec3(beat * walking, 0.0, 0.0)
    : vec3(beat * 0.6, 0.0, beat);
  // A wheel turns steadily about the front-to-back axis through the height its rig names (ADR 0050, W2): a windmill's sails. It takes no beat.
  vec3 facing = aNormal;
  if (spins) {
    float turn = uTime * aRig.z + aRig.y;
    float tc = cos(turn);
    float ts = sin(turn);
    float rise = local.y - aRig.x;
    local = vec3(local.x * tc - rise * ts, aRig.x + local.x * ts + rise * tc, local.z);
    facing = vec3(aNormal.x * tc - aNormal.y * ts, aNormal.x * ts + aNormal.y * tc, aNormal.z);
  }
  // A body tips its nose up or down before it turns (D50): a whale rising to breach, a dolphin arcing through its leap.
  float pc = cos(aPitch);
  float ps = sin(aPitch);
  local = vec3(local.x, local.y * pc + local.z * ps, local.z * pc - local.y * ps);
  vec3 normal = vec3(facing.x, facing.y * pc + facing.z * ps, facing.z * pc - facing.y * ps);
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

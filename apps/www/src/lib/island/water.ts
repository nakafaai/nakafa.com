import { SPAN } from "@repo/backend/confect/island/world";
import { COAST_STEPS } from "@/lib/island/coast";

/**
 * The island's water in GLSL (ADR 0047, D43 and D51), for the chunk program's
 * water pass. It reads how much water lies under each pixel from the depth the
 * solid pass left (copied before the water is drawn) and shows it in four
 * flat bands from a clear shoal to the dark deep, their borders interleaved
 * by an ordered dither; a ring of foam laps wherever the water runs thin
 * against anything in it, a summed swell rolls across it, breaking white in
 * patches of rough water out in the deep, and the sun glints where a wave's
 * slope turns it toward the eye. By the coast map (D51) waves roll in toward
 * the shore in thin bands that follow it, a dashed line laps the sand, still
 * water mirrors its banks, rings spread where something breaks the surface,
 * and short dashes of light flicker in the sun's path. It calls the chunk
 * program's `hashOf`, `noiseOf` and `uWet`.
 */
export const WATER_GLSL = `
uniform sampler2D uSeabed;
uniform sampler2D uCoast;
uniform sampler2D uScene;
uniform mat4 uViewProjection;
uniform vec2 uClip;
const float SPAN = ${SPAN.toFixed(1)};
// How far ahead of the eye a stored depth lies, in blocks.
float viewDepth(float stored) {
  float z = stored * 2.0 - 1.0;
  return (2.0 * uClip.x * uClip.y) / (uClip.y + uClip.x - z * (uClip.y - uClip.x));
}
// A four by four ordered dither by the frame's own pixel, from 0 to 1.
float ditherAt(vec2 pixel) {
  ivec2 at = ivec2(mod(pixel, 4.0));
  int table[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(table[at.x + at.y * 4]) + 0.5) / 16.0;
}
// The swell: three sines across the sea, summed, from -1 to 1.
float swellAt(vec2 place, float time) {
  return sin(dot(place, vec2(0.62, 0.21)) + time * 1.3) * 0.45
    + sin(dot(place, vec2(-0.27, 0.71)) + time * 1.05) * 0.33
    + sin(dot(place, vec2(1.31, -0.83)) + time * 2.1) * 0.22;
}
// The coast map at a place: how far it lies from the shore's edge in blocks, and 1 where its water lies still. The open sea past the world's cells lies far from any land.
vec2 coastAt(vec2 place) {
  vec2 inside = step(vec2(0.0), place) * step(place, vec2(SPAN));
  if (inside.x * inside.y < 0.5) return vec2(16.0, 0.0);
  vec2 map = texture(uCoast, place / SPAN).rg;
  // The map measures from each land column's middle, half a block in from its edge.
  return vec2(map.r * 255.0 / ${COAST_STEPS.toFixed(1)} - 0.5, step(0.5, map.g));
}
// Waves rolling in toward the shore (D51): thin bands that follow the coast's own shape, wobbled by a still noise so they never copy the blocks' steps, near land and only on the open sea, the farthest fading to every other pixel.
float rollOf(vec2 art, float shore, float still, float time) {
  float d = shore + (noiseOf(art * 0.45) - 0.5) * 0.45;
  float near = step(0.3, d) * step(d, 3.4);
  float band = step(mod(d + time * 0.5, 1.35), 0.09);
  float fade = max(step(d, 2.2), step(0.5, fract((art.x + art.y) * 8.0)));
  return band * near * fade * (1.0 - still);
}
// The water lapping the sand (D51): a dashed line two art pixels off the shore stepping out to three and back.
float lapOf(vec2 art, float shore, float time) {
  float off = 0.125 + 0.0625 * step(0.5, fract(time * 0.7 + noiseOf(art * 0.3)));
  return step(abs(shore - off), 0.04) * step(0.35, noiseOf(art * 2.0));
}
// A glint (D51): a short dash of light in the frame's own art pixels, 0.6 s from one pixel to three, five, a split four and two, at its own place and time in each patch of the frame.
float glintOf(vec2 pixel, float time) {
  vec2 cell = floor(pixel / vec2(9.0, 5.0));
  float seed = hashOf(cell * 1.31 + 4.7);
  float period = 2.5 + seed * 4.0;
  float age = fract(time / period + seed * 5.3) * period;
  if (age > 0.6) return 0.0;
  vec2 at = pixel - cell * vec2(9.0, 5.0);
  if (abs(at.y - (1.0 + floor(hashOf(cell + 2.3) * 3.0))) > 0.5) return 0.0;
  float dx = at.x - (3.0 + floor(hashOf(cell + 9.1) * 3.0));
  int stage = int(age / 0.12);
  bool on = stage == 0 ? abs(dx) < 0.5
    : stage == 1 ? abs(dx) < 1.5
    : stage == 2 ? abs(dx) < 2.5
    : stage == 3 ? abs(dx) > 0.5 && abs(dx) < 2.5
    : dx > -0.5 && dx < 1.5;
  return on ? 1.0 : 0.0;
}
// A ring spreading where something breaks the surface (D51): five frames of 0.2 s, one, two, four, six and eight art pixels out, the last two broken as the ring fades; more often in the rain.
float rippleOf(vec2 place, float time, float rain) {
  vec2 cell = floor(place / 2.0);
  float seed = hashOf(cell * 0.73 + 1.9);
  float period = mix(10.0, 2.2, rain) + seed * 6.0;
  float age = fract(time / period + seed * 3.1) * period;
  if (age > 1.0) return 0.0;
  int frame = int(age / 0.2);
  float radius = frame == 0 ? 1.0 : frame == 1 ? 2.0 : frame == 2 ? 4.0 : frame == 3 ? 6.0 : 8.0;
  vec2 centre = cell * 2.0 + 0.5 + vec2(hashOf(cell + 3.3), hashOf(cell + 7.7));
  vec2 offset = floor(place * 16.0) + 0.5 - floor(centre * 16.0);
  float ring = step(abs(length(offset) - radius), 0.55);
  return frame >= 3 ? ring * step(radius * 0.5, abs(offset.y)) : ring;
}
// What still water mirrors at this pixel (D51): a ray from the eye bounced off the surface, marched up through the scene the solid pass left until it passes behind something, and that thing's color there, nearer rows still and farther ones wobbling by a whole art pixel or two. Nothing when the ray meets nothing.
vec4 mirrorOf(vec3 world, vec3 eye, float time) {
  vec3 ray = reflect(normalize(world - eye), vec3(0.0, 1.0, 0.0));
  vec2 frame = vec2(textureSize(uScene, 0));
  for (int i = 1; i <= 16; i++) {
    vec3 at = world + ray * (float(i) * 0.28);
    vec4 clip = uViewProjection * vec4(at, 1.0);
    vec3 ndc = clip.xyz / clip.w;
    vec2 uv = ndc.xy * 0.5 + 0.5;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) break;
    ivec2 texel = ivec2(uv * frame);
    float behind = viewDepth(ndc.z * 0.5 + 0.5) - viewDepth(texelFetch(uSeabed, texel, 0).r);
    if (behind > 0.0 && behind < 1.5) {
      float reach = i >= 6 ? 2.0 : 1.0;
      float wobble = i < 3 ? 0.0 : floor(sin(gl_FragCoord.y * 0.9 + time * 2.2) * reach + 0.5);
      return vec4(texelFetch(uScene, texel + ivec2(int(wobble), 0), 0).rgb, 1.0);
    }
  }
  return vec4(0.0);
}
// The water's color and opacity over this pixel, and in foam how much of it breaks white.
vec4 waterOf(vec3 world, vec3 eye, vec3 toward, float time, float sky, out float foam) {
  float pixel = 1.0 / 16.0;
  vec2 art = floor(world.xz * 16.0) * pixel;
  float bed = viewDepth(texelFetch(uSeabed, ivec2(gl_FragCoord.xy), 0).r);
  float thickness = max(0.0, bed - viewDepth(gl_FragCoord.z));
  float deep = 1.0 - exp(-0.42 * thickness);
  int band = int(clamp(floor(deep * 4.0 + (ditherAt(gl_FragCoord.xy) - 0.5) * 0.35), 0.0, 3.0));
  vec3 tints[4] = vec3[4](vec3(0.42, 0.8, 0.78), vec3(0.2, 0.58, 0.72), vec3(0.08, 0.32, 0.54), vec3(0.04, 0.16, 0.35));
  float opacity[4] = float[4](0.34, 0.6, 0.82, 0.93);
  float swell = swellAt(art, time);
  vec3 tint = tints[band] * (1.0 + 0.08 * step(0.35, swell) - 0.06 * step(swell, -0.45));
  // Crests break only where a slow patch of rough water drifts over the deep, so the sea is never peppered white.
  float rough = step(0.68, noiseOf(art * 0.12 + vec2(time * 0.03, -time * 0.02)));
  float crest = step(0.92, swell + (noiseOf(art * 1.3 + time * 0.2) - 0.5) * 0.3) * rough * step(2.0, float(band));
  float lap = 0.5 + 0.5 * sin(time * 1.4 + noiseOf(art * 0.8) * 6.0);
  float ring = step(thickness, 0.16 + 0.3 * lap);
  vec2 slope = vec2(swellAt(art + vec2(pixel, 0.0), time), swellAt(art + vec2(0.0, pixel), time)) - swell;
  vec3 normal = normalize(vec3(-slope.x * 40.0, 1.0, -slope.y * 40.0));
  float glint = step(0.992, dot(reflect(-toward, normal), normalize(eye - world))) * sky;
  vec2 coast = coastAt(world.xz);
  float still = coast.y;
  float alpha = opacity[band];
  if (still > 0.5) {
    // A bank shows in still water darker than itself, in a few flat tones, as a painted reflection does.
    vec4 seen = mirrorOf(world, eye, time);
    tint = mix(tint, floor(seen.rgb * 0.62 * 4.0 + 0.5) / 4.0, seen.a * 0.75);
    alpha = max(alpha, seen.a * 0.9);
  }
  // The sun's path on the water, where its light bounces toward the eye, is where the short glints flicker.
  float path = step(0.8, dot(reflect(-toward, vec3(0.0, 1.0, 0.0)), normalize(eye - world))) * sky;
  float shine = glintOf(floor(gl_FragCoord.xy), time) * path;
  float waves = max(rollOf(art, coast.x, still, time) * 0.6, lapOf(art, coast.x, time) * 0.8);
  // On a dry day the rings break still water and the water near the shore, where fish rise and things drop in; rain breaks it everywhere.
  float rings = rippleOf(world.xz, time, uWet) * 0.5 * max(uWet, max(still, step(coast.x, 4.0)));
  foam = max(max(ring, max(crest * 0.55, glint * 0.8)), max(waves, max(rings, shine * 0.9)));
  return vec4(tint, alpha);
}`;

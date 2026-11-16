/**
 * The island's water in GLSL (ADR 0047, D43), for the chunk program's water
 * pass. It reads how much water lies under each pixel from the depth the
 * solid pass left (copied before the water is drawn) and shows it in four
 * flat bands from a clear shoal to the dark deep, their borders interleaved
 * by an ordered dither; a ring of foam laps wherever the water runs thin
 * against anything in it, a summed swell rolls across it, breaking white in
 * patches of rough water out in the deep, and the sun glints where a wave's
 * slope turns it toward the eye. It calls the chunk program's `noiseOf`.
 */
export const WATER_GLSL = `
uniform sampler2D uSeabed;
uniform vec2 uClip;
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
  foam = max(ring, max(crest * 0.55, glint * 0.8));
  return vec4(tint, opacity[band]);
}`;

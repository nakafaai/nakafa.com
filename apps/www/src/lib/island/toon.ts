/**
 * The island's light in GLSL (ADR 0047, D43): the sun, or the moon at night,
 * lights a face in three flat bands by how squarely it faces it, a hard
 * shadow map decides what it cannot reach, and shade is tinted cool instead
 * of greyed and a face squarely in the sun warmed, the way a painter shades.
 * The chunk and body programs share it.
 */
export const TOON_GLSL = `
uniform highp sampler2DShadow uShadowMap;
uniform mat4 uSunView;
uniform vec3 uToward;
uniform float uShadowTexel;
// How much of the sun reaches this point of a face: none behind the face or in the shadow of anything between it and the sun, all of it outside the shadow map's box.
float sunlitAt(vec3 world, vec3 normal) {
  float facing = dot(normal, uToward);
  if (facing <= 0.0) {
    return 0.0;
  }
  vec4 clip = uSunView * vec4(world + normal * uShadowTexel * 1.5, 1.0);
  vec3 place = clip.xyz * 0.5 + 0.5;
  if (any(lessThan(place, vec3(0.0))) || any(greaterThan(place, vec3(1.0)))) {
    return 1.0;
  }
  return texture(uShadowMap, vec3(place.xy, place.z - 0.0004));
}
// The light on a face from its ambient and its sun, in three tones (D44): the shade tinted cool, a face half turned to the sun plain, and one squarely in it a touch warm.
vec3 toonLight(vec3 ambient, vec3 sun, vec3 normal, float lit, float occlusion) {
  float facing = dot(normal, uToward);
  float band = facing > 0.55 ? 1.0 : facing > 0.22 ? 0.72 : 0.48;
  float direct = band * lit;
  vec3 shade = ambient * occlusion * mix(vec3(0.8, 0.86, 1.1), vec3(1.0), direct);
  vec3 warmth = mix(vec3(1.0), vec3(1.03, 1.0, 0.96), step(0.99, direct));
  return shade + sun * direct * (0.7 + 0.3 * occlusion) * warmth;
}`;

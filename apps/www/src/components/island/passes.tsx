import { useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  DepthTexture,
  GLSL3,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  RawShaderMaterial,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from "three";
import { PALETTE_SIZE, paletteIndex } from "@/lib/island/palette";
import type { gradeOf } from "@/lib/island/sky";
import { paletteTexture } from "@/lib/island/texture";

const SCREEN_VERTEX = /* glsl */ `
precision highp float;
in vec3 position;
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/**
 * The outline, sky and weather pass (ADR 0042, D15, D18). A pixel whose
 * neighbour lies much farther away is on a silhouette: against the sky it takes
 * the darkest ink, against another surface the darkest tone of its own ramp,
 * which reads as a hand-drawn line; sprites carry their own outlines. Every
 * colour then takes the light's tint and returns to the nearest palette colour,
 * so night and dusk stay pixel art; lamps keep their glow and window panes
 * light up when the grade says so. Empty pixels are sky, in flat bands of the
 * light's ramp, with stars on a clear night. Rain falls in slanted streaks on
 * the art grid, snow drifts in single pixels, fog veils the island, and a
 * storm's lightning lights everything for a moment.
 */
const GRADE_FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D colorTarget;
uniform sampler2D normalTarget;
uniform sampler2D depthTarget;
uniform sampler2D palette;
uniform vec2 resolution;
uniform int paletteSize;
uniform int ink;
uniform int sky;
uniform int glow;
uniform int pane;
uniform int water;
uniform int cloud;
uniform vec3 tint;
uniform bool lit;
uniform bool stars;
uniform bool fog;
uniform int fall;
uniform float time;
uniform float flash;
out vec4 outColor;
float depthAt(ivec2 p) {
  return texelFetch(depthTarget, clamp(p, ivec2(0), ivec2(resolution) - 1), 0).r;
}
vec3 colorOf(int index) { return texelFetch(palette, ivec2(index, 0), 0).rgb; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 nearest(vec3 c) {
  vec3 pick = colorOf(0);
  float best = 1e9;
  for (int i = 0; i < paletteSize; i++) {
    vec3 d = (colorOf(i) - c) * vec3(0.30, 0.59, 0.11);
    float e = dot(d, d);
    if (e < best) { best = e; pick = colorOf(i); }
  }
  return pick;
}
vec3 graded(int index, float depth) {
  int ramp = index / 4;
  int tone = index - ramp * 4;
  if (ramp == glow / 4) return colorOf(index);
  if (lit && ramp == pane / 4) return colorOf(glow + min(tone + 1, 3));
  vec3 c = colorOf(index);
  if (fog) c = mix(c, colorOf(cloud + 2), 0.3 + 0.25 * depth);
  vec3 lightened = c * tint + vec3(flash);
  if (!fog && flash == 0.0 && tint == vec3(1.0)) return c;
  return nearest(lightened);
}
vec3 skyAt(ivec2 p) {
  float y = gl_FragCoord.y / resolution.y;
  int band = y > 0.78 ? 0 : (y > 0.56 ? 1 : (y > 0.32 ? 2 : 3));
  if (stars && band < 2) {
    float twinkle = hash(vec2(p) + floor(time * 0.5));
    if (hash(vec2(p)) > 0.994 && twinkle > 0.3) return colorOf(cloud + 3);
  }
  vec3 c = colorOf(sky + band);
  return flash > 0.0 ? nearest(c + vec3(flash)) : c;
}
vec3 fallen(vec3 c, ivec2 p) {
  if (fall == 1) {
    float column = float(p.x) + floor(float(p.y) * 0.5);
    float h = hash(vec2(column, 7.0));
    if (h < 0.28 && mod(float(p.y) + floor(time * 42.0) + h * 97.0, 23.0) < 2.0) {
      return colorOf(water + 3);
    }
  } else if (fall == 2) {
    float drift = floor(sin(time * 0.8 + float(p.y) * 0.05) * 1.5);
    float h = hash(vec2(float(p.x) + drift, 3.0));
    if (h < 0.12 && mod(float(p.y) + floor(time * 9.0) + h * 211.0, 31.0) < 1.0) {
      return colorOf(cloud + 3);
    }
  }
  return c;
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float d = depthAt(p);
  if (d >= 0.99999) {
    outColor = vec4(fallen(skyAt(p), p), 1.0);
    return;
  }
  vec4 c = texelFetch(colorTarget, p, 0);
  int index = int(c.a * 255.0 + 0.5);
  if (texelFetch(normalTarget, p, 0).a < 0.5) {
    outColor = vec4(fallen(graded(index, d), p), 1.0);
    return;
  }
  float far = max(
    max(depthAt(p + ivec2(1, 0)), depthAt(p - ivec2(1, 0))),
    max(depthAt(p + ivec2(0, 1)), depthAt(p - ivec2(0, 1)))
  );
  vec3 color;
  if (far >= 0.99999) {
    color = colorOf(ink);
  } else if (far - d > 0.004) {
    color = graded(index - index % 4, d);
  } else {
    color = graded(index, d);
  }
  outColor = vec4(fallen(color, p), 1.0);
}
`;

/** What falls from the sky, as the grade pass counts it. */
const FALLS = { none: 0, rain: 1, snow: 2 } as const;

/** Seconds between a storm's lightning strikes, and how long a strike lights the island. */
const STRIKE_GAP = 9;
const STRIKE_LENGTH = 0.14;

/**
 * Sets the grade pass for one frame: the light's tint, the sky's ramp, lit
 * windows, stars, fog and what falls from the sky, the clock that moves rain
 * and snow, and a storm's lightning when a strike is due (ADR 0042, D18).
 */
export function gradePass(
  material: RawShaderMaterial,
  look: ReturnType<typeof gradeOf>,
  time: number
) {
  const uniforms = material.uniforms;
  uniforms.tint.value.set(...look.tint);
  uniforms.sky.value = paletteIndex(look.sky, 0);
  uniforms.lit.value = look.lit;
  uniforms.stars.value = look.stars;
  uniforms.fog.value = look.fog;
  uniforms.fall.value = FALLS[look.fall];
  uniforms.time.value = time;
  uniforms.flash.value =
    look.flash && time % STRIKE_GAP < STRIKE_LENGTH ? 0.45 : 0;
}

const COPY_FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D source;
out vec4 outColor;
void main() { outColor = texelFetch(source, ivec2(gl_FragCoord.xy), 0); }
`;

/**
 * A screen pass: one triangle over the whole screen, never culled, since its
 * shader ignores the camera, and drawn before anything else in its scene.
 */
function screenPass(geometry: BufferGeometry, material: RawShaderMaterial) {
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return new Scene().add(mesh);
}

/** One triangle that covers the whole screen. */
function screenTriangle() {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
  );
  return geometry;
}

/** The targets, scenes and materials of the three passes, for one buffer size. */
export function usePasses(columns: number, rows: number) {
  return useMemo(() => {
    const depth = new DepthTexture(columns, rows);
    const scene = new WebGLRenderTarget(columns, rows, {
      count: 2,
      depthTexture: depth,
      magFilter: NearestFilter,
      minFilter: NearestFilter,
    });
    const outlined = new WebGLRenderTarget(columns, rows, {
      depthBuffer: false,
      magFilter: NearestFilter,
      minFilter: NearestFilter,
    });
    const triangle = screenTriangle();
    const grade = new RawShaderMaterial({
      depthTest: false,
      depthWrite: false,
      fragmentShader: GRADE_FRAGMENT,
      glslVersion: GLSL3,
      uniforms: {
        colorTarget: { value: scene.textures[0] },
        depthTarget: { value: depth },
        normalTarget: { value: scene.textures[1] },
        cloud: { value: paletteIndex("cloud", 0) },
        fall: { value: 0 },
        flash: { value: 0 },
        fog: { value: false },
        glow: { value: paletteIndex("glow", 0) },
        ink: { value: paletteIndex("ink", 0) },
        lit: { value: false },
        palette: { value: paletteTexture() },
        paletteSize: { value: PALETTE_SIZE },
        pane: { value: paletteIndex("pane", 0) },
        resolution: { value: new Vector2(columns, rows) },
        sky: { value: paletteIndex("sky", 0) },
        stars: { value: false },
        time: { value: 0 },
        tint: { value: new Vector3(1, 1, 1) },
        water: { value: paletteIndex("water", 0) },
      },
      vertexShader: SCREEN_VERTEX,
    });
    const outline = screenPass(triangle, grade);
    const copy = screenPass(
      triangle,
      new RawShaderMaterial({
        depthTest: false,
        depthWrite: false,
        fragmentShader: COPY_FRAGMENT,
        glslVersion: GLSL3,
        uniforms: { source: { value: outlined.texture } },
        vertexShader: SCREEN_VERTEX,
      })
    );
    return {
      flat: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
      grade,
      outline,
      outlined,
      scene,
      screen: copy,
    };
  }, [columns, rows]);
}

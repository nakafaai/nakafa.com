import { useFrame } from "@react-three/fiber";
import type { Placement } from "@repo/backend/confect/island/layout";
import { Array as Arr, Option } from "effect";
import { useEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  type BufferGeometry,
  GLSL3,
  type Mesh,
  ShaderMaterial,
  Vector3,
  type WebGLRenderTarget,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { useSkyStore } from "@/components/island/sky";
import { useIsland } from "@/lib/island/context";
import { PALETTE_SIZE, paletteIndex } from "@/lib/island/palette";
import { WATER_BELOW, watersOf } from "@/lib/island/pieces";
import { gradeOf } from "@/lib/island/sky";
import { VOXELS_PER_CELL } from "@/lib/island/terrain";
import { paletteTexture } from "@/lib/island/texture";

/** Three declares the matrices, `position` and `normal`. */
const WATER_VERTEX = /* glsl */ `
out vec3 vWorld;
out vec3 vNormal;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * Water drawn over the outlined scene: it keeps only the pixels in front of the
 * scene, mixes the scene behind it with water, and snaps the mix to the nearest
 * colour of the hidden pixel's own ramp or of the water's: ground leans to the
 * water's colours, and a sprite keeps its own, so an orange fish behind the
 * cross-section stays an orange fish, tinted. Its top glints where a
 * seeded ripple passes, and its sides show a bright waterline. At dusk, dawn
 * and night the water takes the light's tint like the rest of the island and
 * returns to the nearest palette colour (ADR 0042, D18).
 */
const WATER_FRAGMENT = /* glsl */ `
uniform sampler2D sceneColor;
uniform sampler2D sceneIndex;
uniform sampler2D sceneNormal;
uniform sampler2D sceneDepth;
uniform sampler2D palette;
uniform int water;
uniform int paletteSize;
uniform vec3 tint;
uniform float time;
uniform float surface;
in vec3 vWorld;
in vec3 vNormal;
out vec4 outColor;
vec3 colorOf(int index) { return texelFetch(palette, ivec2(index, 0), 0).rgb; }
vec3 nearest(vec3 color, int ramp, float keep) {
  vec3 best = colorOf(water);
  float distance = 1e9;
  for (int i = 0; i < 8; i++) {
    vec3 candidate = colorOf(i < 4 ? ramp + i : water + i - 4);
    vec3 delta = candidate - color;
    float d = dot(delta, delta) * (i < 4 ? keep : 1.0);
    if (d < distance) { distance = d; best = candidate; }
  }
  return best;
}
vec3 shaded(vec3 color) {
  if (tint == vec3(1.0)) return color;
  vec3 lit = color * tint;
  vec3 best = colorOf(0);
  float distance = 1e9;
  for (int i = 0; i < paletteSize; i++) {
    vec3 delta = (colorOf(i) - lit) * vec3(0.30, 0.59, 0.11);
    float d = dot(delta, delta);
    if (d < distance) { distance = d; best = colorOf(i); }
  }
  return best;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  if (gl_FragCoord.z > texelFetch(sceneDepth, p, 0).r + 0.00002) discard;
  vec3 under = texelFetch(sceneColor, p, 0).rgb;
  bool top = vNormal.y > 0.5;
  int index = int(texelFetch(sceneIndex, p, 0).a * 255.0 + 0.5);
  vec3 color = mix(under, colorOf(water + (top ? 3 : 2)), 0.45);
  if (top) {
    vec2 cell = floor(vWorld.xz * 8.0);
    float wave = hash(cell + floor(time * 1.5 + hash(cell) * 6.0));
    if (wave > 0.965) color = colorOf(water + 3) * 1.15;
  } else if (vWorld.y > surface - 0.1) {
    color = colorOf(water + 3);
  }
  bool sprite = texelFetch(sceneNormal, p, 0).a < 0.5;
  outColor = vec4(shaded(nearest(color, index - index % 4, sprite ? 1.0 : 3.0)), 1.0);
}
`;

/** Every pond's water as one geometry in world units, or none for an island without a pond. */
function useWaterGeometry(layout: readonly Placement[]) {
  const geometry = useMemo(
    () =>
      Arr.match(watersOf(layout), {
        onEmpty: Option.none,
        onNonEmpty: (boxes) =>
          Option.some(
            mergeGeometries(
              Arr.map(boxes, ({ from: [x0, y0, z0], to: [x1, y1, z1] }) =>
                new BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate(
                  (x0 + x1) / 2,
                  (y0 + y1) / 2,
                  (z0 + z1) / 2
                )
              )
            )
          ),
      }),
    [layout]
  );
  useEffect(
    () => () => {
      if (Option.isSome(geometry)) {
        geometry.value.dispose();
      }
    },
    [geometry]
  );
  return geometry;
}

/**
 * The island's ponds, drawn over the outlined scene in the pipeline's last pass
 * (ADR 0042, D15): it reads the scene's colour, palette index, normal and depth
 * from the pipeline's targets, and moves its ripples with the clock before each
 * frame is drawn.
 */
export function Water({
  outlined,
  scene,
}: {
  outlined: WebGLRenderTarget;
  scene: WebGLRenderTarget;
}) {
  const { layout } = useIsland();
  const geometry = useWaterGeometry(layout);
  const mesh = useRef<Mesh<BufferGeometry, ShaderMaterial>>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        fragmentShader: WATER_FRAGMENT,
        glslVersion: GLSL3,
        uniforms: {
          palette: { value: paletteTexture() },
          paletteSize: { value: PALETTE_SIZE },
          sceneColor: { value: outlined.texture },
          sceneDepth: { value: scene.depthTexture },
          sceneIndex: { value: scene.textures[0] },
          sceneNormal: { value: scene.textures[1] },
          surface: { value: -WATER_BELOW / VOXELS_PER_CELL },
          time: { value: 0 },
          tint: { value: new Vector3(1, 1, 1) },
          water: { value: paletteIndex("water", 0) },
        },
        vertexShader: WATER_VERTEX,
      }),
    [outlined, scene]
  );
  const sky = useSkyStore();
  useFrame((state) => {
    if (mesh.current !== null) {
      const { phase, weather } = sky.getState();
      const uniforms = mesh.current.material.uniforms;
      uniforms.time.value = state.clock.elapsedTime;
      uniforms.tint.value.set(...gradeOf(phase, weather).tint);
    }
  });
  if (Option.isNone(geometry)) {
    return null;
  }
  return <mesh geometry={geometry.value} material={material} ref={mesh} />;
}

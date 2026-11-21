import { useFrame } from "@react-three/fiber";
import { FIELD_RADIUS } from "@repo/design-system/components/contents/biology/paddy/soil";
import {
  XRAY_GLSL,
  XRAY_VERTEX,
  xrayUniforms,
} from "@repo/design-system/components/contents/biology/paddy/xray";
import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { PADDY_COLORS } from "@repo/design-system/lib/material/paddy";
import { Array as Arr } from "effect";
import type { RefObject } from "react";
import { useEffect, useMemo, useRef } from "react";
import type { Mesh } from "three";
import {
  CircleGeometry,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshPhysicalMaterial,
  RepeatWrapping,
  Vector2,
} from "three";

/**
 * How deep the floodwater stands over the soil, in metres: IRRI keeps paddy
 * fields under 5 cm of ponded water and refloods them to 5 cm (Bouman et al.
 * 2007, Water Management in Irrigated Rice, IRRI).
 */
export const WATER_DEPTH = 0.05;

/** Texels a side of the ripple map, and the metres one tile of it covers. */
const RIPPLE_SIZE = 128;
const RIPPLE_TILE = 0.6;

/**
 * The faint ripples a breeze raises on shallow water, as a tiling normal map:
 * long low swells across the wind and fine cat's-paws over them.
 */
function rippleMap() {
  const height = (column: number, row: number) =>
    0.6 * valueNoise(column / 16, row / 32, RIPPLE_SIZE / 16) +
    0.3 * valueNoise(column / 6, row / 9, RIPPLE_SIZE / 6) +
    0.1 * hashUnit(column, row);
  const data = new Uint8Array(RIPPLE_SIZE * RIPPLE_SIZE * 4);
  Arr.forEach(Arr.range(0, RIPPLE_SIZE - 1), (row) => {
    Arr.forEach(Arr.range(0, RIPPLE_SIZE - 1), (column) => {
      const right = (column + 1) % RIPPLE_SIZE;
      const down = (row + 1) % RIPPLE_SIZE;
      const dx = height(right, row) - height(column, row);
      const dy = height(column, down) - height(column, row);
      const length = Math.hypot(dx * 6, dy * 6, 1);
      data.set(
        [
          Math.round(((-dx * 6) / length / 2 + 0.5) * 255),
          Math.round(((-dy * 6) / length / 2 + 0.5) * 255),
          Math.round((1 / length / 2 + 0.5) * 255),
          255,
        ],
        (row * RIPPLE_SIZE + column) * 4
      );
    });
  });
  const texture = new DataTexture(data, RIPPLE_SIZE, RIPPLE_SIZE);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(FIELD_RADIUS / RIPPLE_TILE, FIELD_RADIUS / RIPPLE_TILE);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** How much of the floodwater's gloss and colour still shows in the middle of the X-ray window. */
const GHOST = 0.15;

/**
 * The floodwater over the field to the haze every way: turbid with clay,
 * still but for a breeze, and mirroring the sky. Over the X-ray window it
 * thins like the mud under it. It stands as high as the flood has risen, and
 * is gone when the field is drained.
 */
export function WaterSurface({ flood }: { readonly flood: RefObject<number> }) {
  const surface = useRef<Mesh>(null);
  const { geometry, material, ripples } = useMemo(() => {
    const disc = new CircleGeometry(FIELD_RADIUS, 128);
    disc.rotateX(-Math.PI / 2);
    const normals = rippleMap();
    const water = new MeshPhysicalMaterial({
      color: PADDY_COLORS.water,
      depthWrite: false,
      ior: 1.33,
      metalness: 0,
      normalMap: normals,
      normalScale: new Vector2(0.22, 0.22),
      opacity: 0.8,
      roughness: 0.06,
      transparent: true,
    });
    const uniforms = xrayUniforms();
    water.onBeforeCompile = (shader) => {
      shader.uniforms = { ...shader.uniforms, ...uniforms };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vXray;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\n${XRAY_VERTEX}`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${XRAY_GLSL}`)
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>\ndiffuseColor.a *= 1.0 - ${(1 - GHOST).toFixed(2)} * xrayWindow(vXray.xz);`
        );
    };
    water.customProgramCacheKey = () => "paddy-water";
    return { geometry: disc, material: water, ripples: normals };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      ripples.dispose();
    },
    [geometry, material, ripples]
  );

  useFrame(() => {
    const mesh = surface.current;
    if (mesh === null) {
      return;
    }
    mesh.position.y = WATER_DEPTH * flood.current;
    mesh.visible = flood.current > 0.02;
  });

  return (
    <CameraBounds exclude>
      <mesh
        geometry={geometry}
        material={material}
        ref={surface}
        renderOrder={2}
      />
    </CameraBounds>
  );
}

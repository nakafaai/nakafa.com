import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useStage } from "@repo/design-system/components/three/stage/context";
import type { Sward } from "@repo/design-system/components/three/stage/cover";
import { layCover } from "@repo/design-system/components/three/stage/cover";
import type { Ground } from "@repo/design-system/components/three/stage/land";
import {
  GROUNDS,
  paintSweep,
} from "@repo/design-system/components/three/stage/land";
import { useLawn } from "@repo/design-system/components/three/stage/lawn";
import {
  FLAT_REACHES,
  landGrid,
  reliefAt,
} from "@repo/design-system/components/three/stage/relief";
import type { Lay } from "@repo/design-system/components/three/stage/shader";
import {
  layGround,
  layKey,
} from "@repo/design-system/components/three/stage/shader";
import { useSurfaceMaps } from "@repo/design-system/components/three/surface/material";
import { useCallback, useEffect, useMemo } from "react";
import type { Material, Texture } from "three";
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
} from "three";

/** How far open ground spreads from the lab's middle, in reaches: past the haze and horizon fade. */
export const GROUND_REACHES = 16;

/**
 * Where open ground starts and finishes dissolving, in reaches from the
 * scene origin: only beyond where the haze has swallowed it from any camera
 * that frames the lab, so it dissolves into the haze of the far distance
 * and never into the backdrop.
 */
export const HORIZON_FADE_INNER = 12;
export const HORIZON_FADE_OUTER = 15.5;

/**
 * Where a top inside a room starts and finishes dissolving into the room
 * behind it, and how far it is drawn, in reaches from the scene origin.
 */
const ROOM = { inner: 1.8, outer: 7.5, spread: 9 } as const;

/** How far a top inside a room lies under the floor, so nothing that stands on the floor flickers through it. */
const TOP_DROP = 0.0004;

/**
 * A material ref callback that lays a ground's program on the material it
 * is given, and over it the cover of the lawn that grows there, when one
 * does.
 */
function useLay({ inner, outer, sweep }: Lay, sward?: Sward | null) {
  return useCallback(
    (material: Material | null) => {
      if (material === null) {
        return;
      }
      material.onBeforeCompile = (program) => {
        layGround(program, { inner, outer, sweep });
        if (sward) {
          layCover(program, sward);
        }
      };
      material.customProgramCacheKey = () =>
        `${layKey({ inner, outer, sweep })}${sward ? "-lawn" : ""}`;
      material.needsUpdate = true;
    },
    [inner, outer, sweep, sward]
  );
}

/**
 * Returns a material ref callback that dissolves a horizontal stage surface
 * (a painted line, a rail, a soil bed, or water) smoothly to transparent
 * between `innerRadius` and `outerRadius` around the scene origin, so no
 * hard horizon edge ever appears against the sky or photo backdrop.
 */
export function useHorizonFade(innerRadius: number, outerRadius: number) {
  return useLay({ inner: innerRadius, outer: outerRadius, sweep: undefined });
}

/** A painted image as a texture that repeats `times` across a surface. */
export function groundTexture(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  times: readonly [across: number, along: number]
) {
  const texture = new DataTexture(pixels, width, height, RGBAFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(...times);
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The sweep of one ground as a texture and how far it reaches before it
 * repeats, in scene units. A planked top keeps the edge of each board
 * crisp; any other ground blends from patch to patch. It is freed with the
 * component that asked for it.
 */
function useSweep(kind: Ground) {
  const { reach } = useStage();
  const sweep = useMemo(() => {
    const { height, pixels, span, width } = paintSweep(kind, reach);
    const texture: Texture = groundTexture(pixels, width, height, [1, 1]);
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = width === 1 ? NearestFilter : LinearFilter;
    return { span, texture };
  }, [kind, reach]);

  useEffect(() => () => sweep.texture.dispose(), [sweep]);

  return sweep;
}

/**
 * The material of one ground, for anything that lies on the stage's floor:
 * the tone, normals and finish of the surface it is made of, under the
 * broad colour of its sweep, dissolving toward the horizon as its ground
 * does. A layer above the ground is drawn a little nearer the camera for
 * each layer under it, because a camera high over a wide lab cannot tell so
 * small a height apart.
 *
 * @param kind - What the ground is made of
 * @param repeat - Tiles across and along the mesh's texture coordinates
 * @param layer - How many layers lie under this one
 * @param alphaMap - Where the surface shows, for a strip with a soft edge
 * @param depthWrite - Whether the surface hides what lies under it
 */
export function GroundMaterial({
  alphaMap,
  depthWrite = true,
  kind,
  layer = 0,
  repeat,
}: {
  readonly alphaMap?: Texture;
  readonly depthWrite?: boolean;
  readonly kind: Ground;
  readonly layer?: number;
  readonly repeat: readonly [across: number, along: number];
}) {
  const { reach } = useStage();
  const { bump, coat, indoor, rough, surface } = GROUNDS[kind];
  const maps = useSurfaceMaps(surface, repeat[0], repeat[1]);
  const sweep = useSweep(kind);
  const lawn = useLawn();
  const lay = useLay(
    {
      inner: (indoor ? ROOM.inner : HORIZON_FADE_INNER) * reach,
      outer: (indoor ? ROOM.outer : HORIZON_FADE_OUTER) * reach,
      sweep,
    },
    kind === "grass" ? lawn : null
  );

  return (
    <meshPhysicalMaterial
      alphaMap={alphaMap ?? null}
      aoMap={maps.finish}
      clearcoat={coat}
      clearcoatRoughness={0.3}
      depthWrite={depthWrite}
      map={maps.tone}
      normalMap={maps.normal}
      normalScale={[bump, bump]}
      polygonOffset={layer > 0}
      polygonOffsetFactor={-layer}
      polygonOffsetUnits={-4 * layer}
      ref={lay}
      roughness={rough}
      roughnessMap={maps.finish}
      transparent
    />
  );
}

/**
 * How high the stage's ground stands at a place, in scene units: zero on a
 * top inside a room, on paved ground and wherever the lab stands, and the
 * rolling height of open land far from it. Whatever lies on the ground far
 * from the lab is laid at this height.
 */
export function useRelief() {
  const { ground, reach } = useStage();
  const rise = ground === undefined ? 0 : GROUNDS[ground].rise;

  return useCallback(
    (x: number, z: number) => reach * reliefAt(x / reach, z / reach, rise),
    [reach, rise]
  );
}

/**
 * The ground a lab stands on. Open ground (grass, asphalt, sand, snow, soil
 * or concrete) runs as far as the eye reaches: flat where the lab stands,
 * rolling gently far from it, and fading into the backdrop's horizon with
 * the haze. A top inside a room (an epoxy bench or a planked table) lies
 * flat and dissolves into the room behind the lab. Either takes the key
 * light's shadows and has no edge to see, so nothing stands on a cut slab.
 * The camera leaves it out when it frames the lab.
 */
export function Terrain({ kind }: { readonly kind: Ground }) {
  const { floor = 0, profile, reach } = useStage();
  const { indoor, rise, tile } = GROUNDS[kind];
  const heightAt = useRelief();
  const geometry = useMemo(() => {
    const radius = (indoor ? ROOM.spread : GROUND_REACHES) * reach;
    const grid = landGrid(
      radius,
      Math.min(FLAT_REACHES * reach, radius / 2),
      rise === 0 ? 1 : profile.landRings,
      profile.landSpokes,
      heightAt
    );
    const land = new BufferGeometry();
    land.setAttribute("position", new BufferAttribute(grid.positions, 3));
    land.setAttribute("uv", new BufferAttribute(grid.uvs, 2));
    land.setIndex(grid.indices);
    land.computeVertexNormals();
    return land;
  }, [heightAt, indoor, profile, reach, rise]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <CameraBounds exclude>
      <mesh
        geometry={geometry}
        position={[0, indoor ? floor - TOP_DROP : floor, 0]}
        receiveShadow
        renderOrder={-10}
        userData={{ treatAsOpaque: true }}
      >
        <GroundMaterial kind={kind} repeat={[1 / tile[0], 1 / tile[1]]} />
      </mesh>
    </CameraBounds>
  );
}

import { paintFoam } from "@repo/design-system/components/three/vehicle/foam";
import { wakeStrength } from "@repo/design-system/components/three/vehicle/motion";
import { wedgeSheet } from "@repo/design-system/components/three/vehicle/wedge";
import { BOAT_COLORS } from "@repo/design-system/lib/material/boat";
import type { Ref } from "react";
import { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { Mesh } from "three";
import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

/** How many foam tiles lie along the wedge. */
const TILES = 7;

/** Pixels along each side of the foam tile. */
const TILE = 256;

/** What a boat drives on its wake every frame. */
export interface WakeRig {
  /**
   * Lays the wake for a moment: its length and strength follow the speed
   * through the water, and the foam drifts astern as fast as the boat leaves
   * it behind.
   */
  readonly trail: (speed: number, length: number, time: number) => void;
}

/** The wedge's sheet as a geometry whose vertices carry how much foam is left. */
function wedgeGeometry() {
  const sheet = wedgeSheet(TILES);
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(sheet.positions, 3)
  );
  geometry.setAttribute("uv", new Float32BufferAttribute(sheet.uvs, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(sheet.colors, 4));
  geometry.setIndex(sheet.indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The wake a boat leaves on the water: foam along the two arms of Kelvin's
 * wedge and in the propeller's wash between them, fading astern. It lies in
 * the boat's own frame with its point at the stern, because the water the
 * boat has passed lies straight behind where it heads, wherever the current
 * carries both. The module paints the foam once and frees it with the boat.
 *
 * @param ref - What the boat drives each frame
 */
export function Wake({ ref }: { readonly ref: Ref<WakeRig> }) {
  const sheet = useRef<Mesh>(null);
  const parts = useMemo(() => {
    const foam = new DataTexture(paintFoam(TILE), TILE, TILE);
    foam.wrapS = RepeatWrapping;
    foam.magFilter = LinearFilter;
    foam.minFilter = LinearMipmapLinearFilter;
    foam.generateMipmaps = true;
    foam.colorSpace = SRGBColorSpace;
    foam.needsUpdate = true;
    return {
      foam,
      geometry: wedgeGeometry(),
      material: new MeshStandardMaterial({
        color: BOAT_COLORS.foam,
        depthWrite: false,
        map: foam,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        roughness: 0.9,
        transparent: true,
        vertexColors: true,
      }),
    };
  }, []);

  useEffect(
    () => () => {
      parts.foam.dispose();
      parts.geometry.dispose();
      parts.material.dispose();
    },
    [parts]
  );

  useImperativeHandle(ref, () => ({
    trail: (speed, length, time) => {
      const mesh = sheet.current;
      if (mesh === null) {
        return;
      }
      const strength = wakeStrength(speed, length);
      const reach = length * (1.5 + 7 * strength);
      mesh.visible = strength > 0.02;
      mesh.scale.set(reach, 1, reach);
      parts.material.opacity = Math.min(1, strength * 1.5);
      parts.foam.offset.x = -(((time * speed * TILES) / reach) % 1);
    },
  }));

  return (
    <mesh
      geometry={parts.geometry}
      material={parts.material}
      ref={sheet}
      renderOrder={2}
    />
  );
}

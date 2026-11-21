import { useFrame } from "@react-three/fiber";
import { usePaddy } from "@repo/design-system/components/contents/biology/paddy/context";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { PADDY_COLORS } from "@repo/design-system/lib/material/paddy";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RingGeometry,
} from "three";

/** How thick the slice is, along the root, in radii of the disc. */
export const SLICE = 0.22;

/** How far out the root reaches in the disc; the rest is the soil round it. */
export const ROOT = 0.8;

/**
 * The two rings of soil round the root in the slice: the mud, its grain and
 * specks painted into its vertex colours, and the rusty stain of a flooded
 * rice root, strongest against the root and fading outward.
 */
function useRings() {
  const rings = useMemo(() => {
    const mud = new RingGeometry(ROOT, 1, 160, 10);
    const mudPositions = mud.getAttribute("position");
    mud.setAttribute(
      "color",
      new BufferAttribute(
        new Float32Array(
          Arr.flatMap(Arr.range(0, mudPositions.count - 1), (index) => {
            const x = mudPositions.getX(index);
            const y = mudPositions.getY(index);
            const grain =
              0.82 +
              0.22 * valueNoise(x * 9 + 4, y * 9, 64) +
              0.12 * valueNoise(x * 31, y * 31 + 2, 64);
            return [grain, grain, grain];
          })
        ),
        3
      )
    );
    const rust = new RingGeometry(ROOT, ROOT + 0.15, 160, 8);
    const rustPositions = rust.getAttribute("position");
    const tone = new Color(PADDY_COLORS.mottle);
    rust.setAttribute(
      "color",
      new BufferAttribute(
        new Float32Array(
          Arr.flatMap(Arr.range(0, rustPositions.count - 1), (index) => {
            const x = rustPositions.getX(index);
            const y = rustPositions.getY(index);
            const out = (Math.hypot(x, y) - ROOT) / 0.15;
            const patch = 0.55 + 0.45 * valueNoise(x * 12, y * 12 + 9, 64);
            return [
              tone.r,
              tone.g,
              tone.b,
              Math.max(0, 1 - out) ** 1.6 * patch,
            ];
          })
        ),
        4
      )
    );
    return { mud, rust };
  }, []);
  useEffect(
    () => () => {
      rings.mud.dispose();
      rings.rust.dispose();
    },
    [rings]
  );
  return rings;
}

/**
 * The lens and the soil round the root in it: a slim metal rim, a faint
 * glass, the mud cut with the root, grey and reduced when flooded and brown
 * when drained, and round a flooded rice root a rusty ring where the oxygen
 * it leaks has turned ferrous iron to ferric.
 */
export function LensBody() {
  const { flood, plant } = usePaddy();
  const rings = useRings();
  const materials = useMemo(
    () => ({
      air: new MeshStandardMaterial({
        color: PADDY_COLORS.airSpace,
        roughness: 1,
      }),
      glass: new MeshPhysicalMaterial({
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        color: PADDY_COLORS.lensGlass,
        depthWrite: false,
        metalness: 0,
        opacity: 0.07,
        roughness: 0.04,
        transparent: true,
      }),
      rim: new MeshPhysicalMaterial({
        clearcoat: 0.6,
        color: PADDY_COLORS.lensRim,
        metalness: 0.7,
        roughness: 0.32,
      }),
      drained: new Color(PADDY_COLORS.drained),
      flooded: new Color(PADDY_COLORS.reduced),
      rust: new MeshStandardMaterial({
        depthWrite: false,
        roughness: 0.85,
        transparent: true,
        vertexColors: true,
      }),
      soil: new MeshStandardMaterial({
        roughness: 0.9,
        side: DoubleSide,
        vertexColors: true,
      }),
    }),
    []
  );
  useEffect(
    () => () => {
      materials.air.dispose();
      materials.glass.dispose();
      materials.rim.dispose();
      materials.rust.dispose();
      materials.soil.dispose();
    },
    [materials]
  );

  useFrame(() => {
    materials.soil.color.lerpColors(
      materials.drained,
      materials.flooded,
      flood.current
    );
    materials.rust.opacity = 0.85 * flood.current;
    materials.rust.visible = plant === "rice" && flood.current > 0.02;
  });

  return (
    <>
      <mesh material={materials.rim}>
        <torusGeometry args={[1.015, 0.035, 12, 96]} />
      </mesh>
      <mesh material={materials.glass} position={[0, 0, SLICE / 2 + 0.06]}>
        <circleGeometry args={[1, 64]} />
      </mesh>
      <mesh
        geometry={rings.mud}
        material={materials.soil}
        position={[0, 0, SLICE / 2]}
      />
      <mesh
        geometry={rings.rust}
        material={materials.rust}
        position={[0, 0, SLICE / 2 + 0.002]}
      />
      <mesh material={materials.air} position={[0, 0, -SLICE / 2]}>
        <circleGeometry args={[ROOT, 48]} />
      </mesh>
    </>
  );
}

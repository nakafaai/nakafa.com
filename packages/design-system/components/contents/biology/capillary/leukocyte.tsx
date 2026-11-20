import { useFrame } from "@react-three/fiber";
import {
  inner,
  VENULE,
} from "@repo/design-system/components/contents/biology/capillary/bed";
import {
  useFlowTime,
  useScratch,
} from "@repo/design-system/components/contents/biology/capillary/flow";
import type { Axis } from "@repo/design-system/components/contents/biology/capillary/sweep";
import { pointOn } from "@repo/design-system/components/contents/biology/capillary/sweep";
import { useBumpySphere } from "@repo/design-system/components/contents/biology/surface";
import { CAPILLARY_COLORS } from "@repo/design-system/lib/material/capillary";
import { Array as Arr } from "effect";
import { createRef, useMemo } from "react";
import type { Group } from "three";

/** How many white cells roll along the venule. */
const WHITE = 2;

/**
 * Two neutrophils rolling slowly along the venule's lower wall, as white
 * cells do in venules before they squeeze out into the tissue (OpenStax
 * Anatomy and Physiology 2e, 18.4): 11 micrometres across, larger than a
 * red cell, with a nucleus of several lobes showing through.
 */
export function WhiteCells({ axis }: { readonly axis: Axis }) {
  const body = useBumpySphere(0.55, 5, 0.1);
  const time = useFlowTime(0);
  const scratch = useScratch();
  const cells = useMemo(
    () =>
      Arr.map(Arr.range(1, WHITE), (id) => ({ id, ref: createRef<Group>() })),
    []
  );
  useFrame(() => {
    Arr.forEach(cells, (cell, index) => {
      const group = cell.ref.current;
      if (group === null) {
        return;
      }
      const span = 0.55 * axis.length;
      const run =
        0.38 * axis.length +
        (((index * span) / WHITE + time.current * 0.06) % span);
      pointOn(
        axis,
        run / axis.length,
        inner(VENULE) - 0.57,
        Math.PI,
        scratch.point
      );
      group.position.copy(scratch.point);
      group.rotation.set(run / 0.55, 0, 0);
    });
  });
  return (
    <group>
      {Arr.map(cells, (cell) => (
        <group key={cell.id} ref={cell.ref}>
          <mesh castShadow geometry={body}>
            <meshPhysicalMaterial
              clearcoat={0.15}
              color={CAPILLARY_COLORS.leukocyte}
              opacity={0.78}
              roughness={0.65}
              transparent
            />
          </mesh>
          {Arr.map([-1, 0, 1] as const, (lobe) => (
            <mesh
              key={lobe}
              position={[lobe * 0.17, 0.05 * Math.abs(lobe), 0.06 * lobe]}
            >
              <sphereGeometry args={[0.15, 16, 12]} />
              <meshStandardMaterial
                color={CAPILLARY_COLORS.leukocyteNucleus}
                roughness={0.5}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

import { useFrame } from "@react-three/fiber";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import { useBumpySphere } from "@repo/design-system/components/contents/biology/surface";
import type { Point } from "@repo/design-system/components/contents/biology/synapse/anatomy";
import { ENZYMES } from "@repo/design-system/components/contents/biology/synapse/anatomy";
import { useSynapse } from "@repo/design-system/components/contents/biology/synapse/context";
import { topNormal } from "@repo/design-system/components/contents/biology/synapse/dendrite";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { SYNAPSE_COLORS } from "@repo/design-system/lib/material/synapse";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { Object3D } from "three";

/**
 * Botulinum toxin's light chains inside the bouton, at the active zone
 * between the docked vesicles, where they cleave the SNARE proteins.
 */
const TOXINS: readonly Point[] = [
  [-4.4, 4.62, -0.95],
  [0.6, 4.66, -1],
  [5.3, 4.62, -0.95],
];

/** Drug molecules drifting free in the cleft, besides those bound to the receptors. */
const DRIFTING = 12;

/**
 * The drug in the synapse, where it acts: an organophosphate bound in every
 * enzyme's active site, botulinum toxin in the bouton, and nicotine or curare
 * drifting in the cleft besides the molecules on the receptors.
 */
export function Drugs() {
  const { treatment } = useSynapse();
  const toxin = useBumpySphere(0.45, 13, 0.18);
  if (treatment === "organophosphate") {
    return (
      <Instances
        placements={Arr.map(ENZYMES, ([x, y, z]) => {
          const [, ny, nz] = topNormal(z);
          return { position: [x, y + 1.25 * ny, z + 1.25 * nz] as const };
        })}
      >
        <icosahedronGeometry args={[0.2, 1]} />
        <meshPhysicalMaterial
          clearcoat={0.7}
          color={SYNAPSE_COLORS.organophosphate}
          roughness={0.35}
        />
      </Instances>
    );
  }
  if (treatment === "botulinum") {
    return (
      <Instances placements={Arr.map(TOXINS, (position) => ({ position }))}>
        <primitive attach="geometry" object={toxin} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={SYNAPSE_COLORS.botulinum}
          roughness={0.5}
        />
      </Instances>
    );
  }
  if (treatment === "nicotine" || treatment === "curare") {
    return <Drifting color={SYNAPSE_COLORS[treatment]} />;
  }
  return null;
}

/** Drug molecules drifting slowly through the cleft. */
function Drifting({ color }: { readonly color: string }) {
  const { clock } = useSynapse();
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useFrame(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    Arr.forEach(Arr.range(0, DRIFTING - 1), (index) => {
      const phase = clock.current * 0.25 + 6 * hashUnit(index, 9);
      dummy.position.set(
        -14 + 28 * hashUnit(index, 1) + 0.8 * Math.sin(phase),
        1.55 + 0.3 * hashUnit(index, 2) + 0.15 * Math.sin(phase * 1.7),
        -0.8 - 5.5 * hashUnit(index, 3) + 0.5 * Math.cos(phase)
      );
      dummy.rotation.set(phase, phase * 0.7, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh args={[undefined, undefined, DRIFTING]} ref={mesh}>
      <dodecahedronGeometry args={[0.34, 1]} />
      <meshPhysicalMaterial clearcoat={0.6} color={color} roughness={0.38} />
    </instancedMesh>
  );
}

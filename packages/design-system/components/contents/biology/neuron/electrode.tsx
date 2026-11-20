import {
  FIBRE,
  stationOf,
} from "@repo/design-system/components/contents/biology/neuron/course";
import { ELECTRODE } from "@repo/design-system/components/contents/biology/neuron/playback";
import { useOwned } from "@repo/design-system/components/contents/biology/neuron/tissue";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { NEURON_COLORS } from "@repo/design-system/lib/material/neuron";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import {
  DoubleSide,
  LatheGeometry,
  MeshPhysicalMaterial,
  Quaternion,
  Vector2,
  Vector3,
} from "three";

/** How long the drawn taper of the pipette is, and how wide it gets, in units of 10 µm. */
const TAPER = { length: 13, width: 1.3 } as const;

/** The way the pipette comes in: from above, a little toward the reader and to the right. */
const APPROACH = new Vector3(0.28, 1, 0.42).normalize();

/** The pipette's outline from its tip up its taper, at `inset` inside its outer wall. */
function profile(inset: number) {
  return Arr.map(Arr.range(0, 48), (step) => {
    const along = step / 48;
    const radius = Math.max(0.004, 0.028 + TAPER.width * along ** 1.7 - inset);
    return new Vector2(radius, along * TAPER.length);
  });
}

/**
 * Borosilicate glass, refractive index about 1.47, which transmits and bends
 * the light behind it rather than glowing, so the pipette reads as glass in
 * a light card and a dark one alike.
 */
function useGlass() {
  return useOwned(
    useMemo(
      () =>
        new MeshPhysicalMaterial({
          attenuationColor: NEURON_COLORS.pipette,
          attenuationDistance: 1.5,
          clearcoat: 1,
          clearcoatRoughness: 0.03,
          color: NEURON_COLORS.pipette,
          ior: 1.47,
          metalness: 0,
          roughness: 0.04,
          side: DoubleSide,
          thickness: 0.35,
          transmission: 1,
        }),
      []
    )
  );
}

/**
 * The recording electrode at the node it listens to: a glass pipette pulled
 * to a fine tip that rests on the axon, in the node of Ranvier of a
 * myelinated fibre and through the Schwann cell of a bare one, filled with a
 * clear salt solution, with the chloride-coated silver wire that carries the
 * potential to the amplifier running down inside it.
 */
export function Electrode({ myelinated }: { readonly myelinated: boolean }) {
  const { point, tangent } = stationOf(ELECTRODE);
  const across = APPROACH.clone()
    .addScaledVector(tangent, -APPROACH.dot(tangent))
    .normalize();
  const tip = point
    .clone()
    .addScaledVector(across, myelinated ? FIBRE.node : FIBRE.bare);
  const turn = useMemo(
    () => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), APPROACH),
    []
  );
  const glass = useOwned(useMemo(() => new LatheGeometry(profile(0), 40), []));
  const material = useGlass();
  return (
    <group position={tip} quaternion={turn}>
      <mesh geometry={glass} material={material} />
      <mesh castShadow position={[0, TAPER.length * 0.7, 0]}>
        <cylinderGeometry args={[0.06, 0.06, TAPER.length * 0.6, 12]} />
        <MetalMaterial color={NEURON_COLORS.chloride} roughness={0.75} />
      </mesh>
    </group>
  );
}

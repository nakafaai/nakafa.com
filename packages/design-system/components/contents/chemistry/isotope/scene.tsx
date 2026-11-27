import { useReducedMotion } from "@mantine/hooks";
import { useFrame } from "@react-three/fiber";
import type { ISOTOPE_SAMPLES } from "@repo/design-system/components/contents/chemistry/isotope/data";
import {
  useInvalidateOnChange,
  useSimulationClock,
} from "@repo/design-system/components/contents/simulation/clock";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { AtomNucleus } from "@repo/design-system/components/three/atom/core";
import {
  packOf,
  reachOf,
} from "@repo/design-system/components/three/atom/nucleus";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { getColor } from "@repo/design-system/lib/color";
import { PARTICLE_COLORS } from "@repo/design-system/lib/material/particle";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import type { ReactNode } from "react";
import { useMemo, useRef } from "react";
import type { Group } from "three";

/** The radius of one nucleon, in scene units. */
const NUCLEON = 0.5;

/** The dark of open space behind the nucleus, which outlines its labels, and how wide that outline is. */
const BACKDROP = getColor("ZINC", 950);
const OUTLINE = 0.012;

/**
 * One isotope's nucleus, close enough to count: every proton and neutron a
 * sphere resting against its neighbours, turning slowly while the card
 * plays, with the isotope's notation above it and the count of each kind of
 * nucleon beside it. Isotopes of one element show the same protons and a
 * different number of neutrons.
 */
export function IsotopeScene({
  name,
  sample,
}: {
  readonly name: ReactNode;
  readonly sample: (typeof ISOTOPE_SAMPLES)[keyof typeof ISOTOPE_SAMPLES];
}) {
  useInvalidateOnChange(sample);
  const { advance, playing } = useSimulationClock(0);
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });
  const nucleus = useRef<Group>(null);
  const neutrons = sample.massNumber - sample.atomicNumber;
  const reach = useMemo(
    () => reachOf(packOf(sample.atomicNumber, neutrons)) * NUCLEON,
    [neutrons, sample.atomicNumber]
  );

  useFrame((_, delta) => {
    const time = calm ? 0 : advance(delta);
    if (nucleus.current !== null) {
      nucleus.current.rotation.y = 0.5 + time * 0.3;
      nucleus.current.rotation.x = 0.3 + Math.sin(time * 0.4) * 0.15;
    }
  });

  return (
    <group>
      <SimulationTicker running={playing && !calm} />
      <CameraControls
        cameraPosition={[0, 0.6, 6]}
        cameraTarget={[0, 0, 0]}
        fov={40}
        framing="content"
      />
      <CameraBounds
        bounds={{
          x: { min: -reach, max: reach },
          y: { min: -reach, max: reach },
          z: { min: -reach, max: reach },
        }}
      >
        <group />
      </CameraBounds>
      <CameraBounds exclude>
        <group ref={nucleus}>
          <AtomNucleus
            neutrons={neutrons}
            nucleon={NUCLEON}
            protons={sample.atomicNumber}
          />
        </group>
      </CameraBounds>
      <ThreeLabel
        anchorY="bottom"
        color={QUANTUM_COLORS.spaceLabel}
        fontSize="display"
        outlineColor={BACKDROP}
        outlineWidth={OUTLINE}
        position={[0, reach * 1.1, 0]}
      >
        {name}
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={PARTICLE_COLORS.proton}
        fontSize="reading"
        outlineColor={BACKDROP}
        outlineWidth={OUTLINE}
        position={[-reach * 1.12, 0, 0]}
      >
        <InlineMath math={`p^+ = ${sample.atomicNumber}`} />
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={PARTICLE_COLORS.neutron}
        fontSize="reading"
        outlineColor={BACKDROP}
        outlineWidth={OUTLINE}
        position={[reach * 1.12, 0, 0]}
      >
        <InlineMath math={`n^0 = ${neutrons}`} />
      </ThreeLabel>
    </group>
  );
}

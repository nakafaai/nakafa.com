import { useReducedMotion } from "@mantine/hooks";
import { useFrame } from "@react-three/fiber";
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

/**
 * The half side of the cube the camera frames, as a share of the nucleus's
 * radius: the camera fits a box by its corners, which stand well outside
 * the ball inside it, so a smaller cube lets the nucleus fill the card.
 */
const CUBE = 0.66;

/**
 * How the nucleus is turned and tilted at rest, in radians: the pose in
 * which neither deuterium nor tritium hides a nucleon behind another, so
 * the smallest nuclei can be counted before the card plays.
 */
const REST_TURN = 5.45;
const REST_TILT = -0.55;

/** The dark of open space behind the nucleus, which outlines its labels, and how wide that outline is. */
const BACKDROP = getColor("ZINC", 950);
const OUTLINE = 0.012;

/**
 * One nuclide's nucleus, close enough to count: every proton and neutron a
 * sphere resting against its neighbours, turning slowly while the card
 * plays, with the nuclide's notation above it, the count of each kind of
 * nucleon beside it, and a caption below when the lab has one. Isotopes of
 * one element show the same protons and a different number of neutrons.
 */
export function NuclideScene({
  caption,
  neutrons,
  notation,
  protons,
}: {
  readonly caption?: ReactNode;
  readonly neutrons: number;
  readonly notation: ReactNode;
  readonly protons: number;
}) {
  useInvalidateOnChange(`${protons}:${neutrons}`);
  const { advance, playing } = useSimulationClock(0);
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });
  const nucleus = useRef<Group>(null);
  const reach = useMemo(
    () => reachOf(packOf(protons, neutrons)) * NUCLEON,
    [neutrons, protons]
  );

  useFrame((_, delta) => {
    const time = calm ? 0 : advance(delta);
    if (nucleus.current !== null) {
      nucleus.current.rotation.y = REST_TURN + time * 0.3;
      nucleus.current.rotation.x = REST_TILT + Math.sin(time * 0.4) * 0.15;
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
          x: { min: -reach * CUBE, max: reach * CUBE },
          y: { min: -reach * CUBE, max: reach * CUBE },
          z: { min: -reach * CUBE, max: reach * CUBE },
        }}
      >
        <group />
      </CameraBounds>
      <CameraBounds exclude>
        <group ref={nucleus}>
          <AtomNucleus
            neutrons={neutrons}
            nucleon={NUCLEON}
            protons={protons}
          />
        </group>
      </CameraBounds>
      <ThreeLabel
        anchorY="bottom"
        color={QUANTUM_COLORS.spaceLabel}
        fontSize={reach * 0.3}
        outlineColor={BACKDROP}
        outlineWidth={OUTLINE}
        position={[0, reach * 1.02, 0]}
      >
        {notation}
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={QUANTUM_COLORS.spaceLabel}
        fontSize={reach * 0.2}
        outlineColor={BACKDROP}
        outlineWidth={OUTLINE}
        position={[0, -reach * 1.02, 0]}
        visible={caption !== undefined}
      >
        {caption}
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={PARTICLE_COLORS.proton}
        fontSize={reach * 0.2}
        outlineColor={BACKDROP}
        outlineWidth={OUTLINE}
        position={[-reach * 1.04, 0, 0]}
      >
        <InlineMath math={`p^+ = ${protons}`} />
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={PARTICLE_COLORS.neutron}
        fontSize={reach * 0.2}
        outlineColor={BACKDROP}
        outlineWidth={OUTLINE}
        position={[reach * 1.04, 0, 0]}
      >
        <InlineMath math={`n^0 = ${neutrons}`} />
      </ThreeLabel>
    </group>
  );
}

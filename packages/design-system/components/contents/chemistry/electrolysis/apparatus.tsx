import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  BATTERY_Y,
  type Path,
  pointAlong,
  TERMINAL_OFFSET,
} from "@repo/design-system/components/contents/chemistry/electrolysis/circuit";
import type { ElectrolysisColors } from "@repo/design-system/components/contents/chemistry/electrolysis/color";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

/** The beaker's inner radius and height. */
export const BEAKER_RADIUS = 0.42;
const BEAKER_HEIGHT = 0.95;

/** How high the electrolyte stands in the beaker. */
export const LIQUID_HEIGHT = 0.62;

/** The height of an electrode's bottom, clear of the beaker's floor. */
export const ELECTRODE_BOTTOM = 0.12;

/** An electrode plate's thickness and width. */
export const ELECTRODE_THICKNESS = 0.07;
export const ELECTRODE_WIDTH = 0.14;

/** The dots that stand for electrons on each lead, and how fast they move. */
const ELECTRONS_PER_LEAD = 6;
const ELECTRON_SPEED = 0.16;

/** The bubbles a gas electrode gives off. */
const BUBBLES = 6;

/** A glass beaker, open at the top, standing on the bench at y = 0. */
export function Beaker({ colors }: { readonly colors: ElectrolysisColors }) {
  return (
    <group>
      <mesh position={[0, BEAKER_HEIGHT / 2, 0]}>
        <cylinderGeometry
          args={[
            BEAKER_RADIUS,
            BEAKER_RADIUS * 0.97,
            BEAKER_HEIGHT,
            48,
            1,
            true,
          ]}
        />
        <GlassMaterial color={colors.glass} />
      </mesh>
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[BEAKER_RADIUS * 0.97, 48]} />
        <GlassMaterial color={colors.glass} opacity={0.32} />
      </mesh>
    </group>
  );
}

/** Bubbles rising from an electrode's submerged face to the surface. */
export function Bubbles({ color }: { readonly color: string }) {
  const group = useRef<Group>(null);

  useFrame(({ clock }) => {
    Arr.forEach(group.current?.children ?? [], (bubble, index) => {
      const progress = (clock.elapsedTime * 0.35 + index / BUBBLES) % 1;
      bubble.position.set(
        (index % 2 === 0 ? 1 : -1) * (ELECTRODE_THICKNESS / 2 + 0.025),
        ELECTRODE_BOTTOM +
          0.04 +
          progress * (LIQUID_HEIGHT - ELECTRODE_BOTTOM - 0.06),
        ((index % 3) - 1) * 0.04
      );
    });
  });

  return (
    <CameraBounds exclude>
      <group ref={group}>
        {Arr.makeBy(BUBBLES, (index) => (
          <mesh key={String(index)}>
            <sphereGeometry args={[0.018, 12, 8]} />
            <meshStandardMaterial
              color={color}
              opacity={0.7}
              roughness={0.1}
              transparent
            />
          </mesh>
        ))}
      </group>
    </CameraBounds>
  );
}

/** The battery: a dark cell with its positive terminal on the left. */
export function Battery({
  colors,
  label,
}: {
  readonly colors: ElectrolysisColors;
  readonly label: string;
}) {
  return (
    <group position={[0, BATTERY_Y, 0]}>
      <mesh castShadow>
        <boxGeometry args={[TERMINAL_OFFSET * 2, 0.16, 0.14]} />
        <meshStandardMaterial color={colors.battery} roughness={0.5} />
      </mesh>
      <ThreeLabel
        color={colors.text}
        fontSize="compact"
        outlineColor={colors.halo}
        outlineWidth={0.004}
        position={[-TERMINAL_OFFSET + 0.09, 0, 0.08]}
      >
        <InlineMath math="+" />
      </ThreeLabel>
      <ThreeLabel
        color={colors.text}
        fontSize="compact"
        outlineColor={colors.halo}
        outlineWidth={0.004}
        position={[TERMINAL_OFFSET - 0.09, 0, 0.08]}
      >
        <InlineMath math="-" />
      </ThreeLabel>
      <ThreeLabel
        color={colors.text}
        fontSize="compact"
        outlineColor={colors.halo}
        outlineWidth={0.004}
        position={[0, 0.2, 0]}
      >
        {label}
      </ThreeLabel>
    </group>
  );
}

/** One lead and the electrons moving along it. */
export function Lead({
  colors,
  lead,
}: {
  readonly colors: ElectrolysisColors;
  readonly lead: Path;
}) {
  const group = useRef<Group>(null);

  useFrame(({ clock }) => {
    Arr.forEach(group.current?.children ?? [], (electron, index) => {
      const [x, y, z] = pointAlong(
        lead,
        clock.elapsedTime * ELECTRON_SPEED + index / ELECTRONS_PER_LEAD
      );
      electron.position.set(x, y, z);
    });
  });

  return (
    <group>
      <Line color={colors.wire} lineWidth={2.2} points={[...lead]} />
      <CameraBounds exclude>
        <group ref={group}>
          {Arr.makeBy(ELECTRONS_PER_LEAD, (index) => (
            <mesh key={String(index)}>
              <sphereGeometry args={[0.02, 12, 8]} />
              <meshStandardMaterial color={colors.electron} roughness={0.3} />
            </mesh>
          ))}
        </group>
      </CameraBounds>
    </group>
  );
}

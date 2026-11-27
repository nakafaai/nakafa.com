import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import { OakBoard } from "@repo/design-system/components/contents/physics/bench/board";
import { Bulb } from "@repo/design-system/components/contents/physics/bench/bulb";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { DryCell } from "@repo/design-system/components/contents/physics/bench/cell";
import { Lead } from "@repo/design-system/components/contents/physics/bench/lead";
import { Resistor } from "@repo/design-system/components/contents/physics/bench/resistor";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import {
  Ldr,
  Transistor,
} from "@repo/design-system/components/contents/physics/electronics/parts";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import type { ReactNode } from "react";
import { AdditiveBlending, DoubleSide } from "three";

const LDR_AT = [-0.25, 0, 0.2] as const;
const LAMP_HEIGHT = 0.95;

const FEED_DIVIDER = [
  [-1.2, 0.09, -0.32],
  [-0.98, 0.04, -0.42],
  [-0.75, 0.11, -0.45],
] as const;
const DIVIDER = [
  [-0.25, 0.11, -0.45],
  [-0.2, 0.05, -0.22],
  [-0.25, 0.09, 0],
] as const;
const TO_BASE = [
  [-0.25, 0.09, 0],
  [0, 0.04, 0.09],
  [0.16, 0.09, 0.05],
] as const;
const FEED_BULB = [
  [-1.2, 0.09, -0.32],
  [-1.02, 0.035, -0.74],
  [0.4, 0.035, -0.8],
  [0.95, 0.035, -0.57],
] as const;
const TO_COLLECTOR = [
  [0.95, 0.035, -0.33],
  [0.82, 0.04, -0.2],
  [0.6, 0.09, -0.12],
] as const;
const HOME = [
  [0.6, 0.09, 0.22],
  [0.3, 0.035, 0.72],
  [-0.6, 0.035, 0.78],
  [-1.2, 0.09, 0.52],
] as const;
const DIVIDER_HOME = [
  [-0.25, 0.09, 0.4],
  [-0.42, 0.035, 0.6],
  [-1, 0.04, 0.62],
  [-1.2, 0.09, 0.52],
] as const;

/** The lamp that sets the light level: a shade on a bent stand over the light-dependent resistor, as bright as `light` from 0 to 1. */
export function Lamp({ light }: { readonly light: number }) {
  return (
    <group position={LDR_AT}>
      <mesh castShadow position={[-0.42, 0.015, 0]}>
        <cylinderGeometry args={[0.13, 0.15, 0.03, 32]} />
        <MetalMaterial color={APPARATUS_COLORS.caseSteel} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[-0.42, LAMP_HEIGHT / 2 + 0.06, 0]}>
        <cylinderGeometry args={[0.014, 0.014, LAMP_HEIGHT + 0.12, 12]} />
        <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.25} />
      </mesh>
      <mesh
        castShadow
        position={[-0.21, LAMP_HEIGHT + 0.12, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.014, 0.014, 0.42, 12]} />
        <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.25} />
      </mesh>
      <mesh castShadow position={[0, LAMP_HEIGHT, 0]}>
        <coneGeometry args={[0.2, 0.24, 36, 1, true]} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          color={APPARATUS_COLORS.caseDark}
          metalness={0.4}
          roughness={0.35}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[0, LAMP_HEIGHT - 0.06, 0]}>
        <sphereGeometry args={[0.07, 24, 18]} />
        <meshStandardMaterial
          color={APPARATUS_COLORS.lampGlass}
          emissive={APPARATUS_COLORS.lampHalo}
          emissiveIntensity={0.05 + light * 6}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[0, (LAMP_HEIGHT - 0.12) / 2, 0]}>
        <coneGeometry args={[0.36, LAMP_HEIGHT - 0.12, 36, 1, true]} />
        <meshBasicMaterial
          blending={AdditiveBlending}
          color={APPARATUS_COLORS.lampHalo}
          depthWrite={false}
          opacity={light * 0.16}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
      <pointLight
        color={APPARATUS_COLORS.lampHalo}
        distance={2}
        intensity={light * 1.4}
        position={[0, LAMP_HEIGHT - 0.2, 0]}
      />
    </group>
  );
}

/**
 * The automatic lamp on its oak board: the fixed resistor above the
 * light-dependent resistor, which sits under a lamp that sets the light
 * level; their junction drives the transistor's base, and the bulb in the
 * collector circuit lights once the base reaches the switching voltage.
 */
export function TransistorSwitchScene({
  base,
  children,
  on,
}: {
  readonly base: number;
  /** The lamp that stands over the light-dependent resistor. */
  readonly children: ReactNode;
  readonly on: boolean;
}) {
  const quantity = useQuantity();

  return (
    <group>
      <BenchCamera
        narrow={[-0.1, 3.1, 5.1]}
        target={[-0.1, 0.3, 0]}
        wide={[-0.1, 2.4, 3.95]}
      />
      <SeamlessBenchSurface />
      <group position={[-0.1, 0, 0]}>
        <OakBoard depth={2} width={3.1} />
      </group>
      <group position={[0, 0.07, 0]}>
        <group position={[-1.2, 0, 0.1]} rotation={[0, Math.PI / 2, 0]}>
          <DryCell />
        </group>
        <group position={[-0.5, 0, -0.45]}>
          <Resistor />
        </group>
        <Tag position={[-0.5, 0.32, -0.45]}>
          <InlineMath math="R" />
        </Tag>
        <group position={LDR_AT}>
          <Ldr />
        </group>
        {children}
        <Tag position={[0.14, 0.44, 0.32]}>
          <InlineMath math={`V_B=${quantity(base, "\\text{ V}", 2)}`} />
        </Tag>
        <group position={[0.4, 0, 0.05]}>
          <Transistor />
        </group>
        <group position={[0.95, 0, -0.45]} rotation={[0, Math.PI / 2, 0]}>
          <Bulb glow={on ? 0.95 : 0} />
        </group>
        <Lead
          color={APPARATUS_COLORS.leadRed}
          points={FEED_DIVIDER}
          radius={0.016}
        />
        <Lead
          color={APPARATUS_COLORS.leadYellow}
          points={DIVIDER}
          radius={0.016}
        />
        <Lead
          color={APPARATUS_COLORS.leadYellow}
          points={TO_BASE}
          radius={0.016}
        />
        <Lead
          color={APPARATUS_COLORS.leadRed}
          flow={on ? 0.9 : 0}
          points={FEED_BULB}
        />
        <Lead
          color={APPARATUS_COLORS.leadRed}
          flow={on ? 0.9 : 0}
          points={TO_COLLECTOR}
        />
        <Lead
          color={APPARATUS_COLORS.leadBlack}
          flow={on ? 0.9 : 0}
          points={HOME}
        />
        <Lead
          color={APPARATUS_COLORS.leadBlack}
          points={DIVIDER_HOME}
          radius={0.016}
        />
      </group>
    </group>
  );
}

import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import {
  SUPPLY_SOCKETS,
  Supply,
} from "@repo/design-system/components/contents/physics/bench/cell";
import { Lead } from "@repo/design-system/components/contents/physics/bench/lead";
import { HeatingCoil } from "@repo/design-system/components/contents/physics/bench/resistor";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import { DoubleSide } from "three";

const SUPPLY_X = -1.05;
const HEATER_X = 0.42;
const SPAN = 1.36;
/** How fast the charge markers of one ampere drift, in scene units a second. */
const DRIFT = 0.22;

const GUARD = [0.07, 0.15, 0.23, 0.31] as const;
const ENDS = [-1, 1] as const;

const LIVE = [
  [SUPPLY_X + SUPPLY_SOCKETS[0][0], SUPPLY_SOCKETS[0][1], 0.3],
  [SUPPLY_X + 0.3, 0.03, 0.52],
  [HEATER_X - SPAN / 2 - 0.02, 0.03, 0.5],
  [HEATER_X - SPAN / 2 - 0.04, 0.2, 0.12],
] as const;
const NEUTRAL = [
  [HEATER_X + SPAN / 2 + 0.04, 0.2, 0.12],
  [HEATER_X + SPAN / 2 + 0.06, 0.03, 0.56],
  [HEATER_X - 0.2, 0.025, 0.72],
  [SUPPLY_X + 0.2, 0.03, 0.62],
  [SUPPLY_X + SUPPLY_SOCKETS[1][0], SUPPLY_SOCKETS[1][1], 0.3],
] as const;

/**
 * The heater on the bench: a nichrome coil wound on a ceramic rod in front of
 * a polished reflector, between two porcelain end blocks and behind a wire
 * guard, fed from a bench supply whose display shows the voltage. The coil
 * glows with the share of its rated power it draws now.
 */
export function HeaterSupplyScene({
  current,
  power,
  rated,
  ratedVoltage,
  supply,
}: {
  readonly current: number;
  readonly power: number;
  readonly rated: number;
  readonly ratedVoltage: number;
  readonly supply: number;
}) {
  const quantity = useQuantity();
  const glow = Math.sqrt(Math.min(power / rated, 1.2) / 1.2);

  return (
    <group>
      <BenchCamera
        narrow={[-0.15, 2.4, 5]}
        target={[-0.15, 0.22, 0.1]}
        wide={[-0.15, 1.45, 3.4]}
      />
      <SeamlessBenchSurface />
      <group position={[SUPPLY_X, 0, 0]}>
        <Supply share={supply / (ratedVoltage * 1.1)}>
          <InlineMath math={quantity(supply, "\\text{ V}", 0)} />
        </Supply>
      </group>
      <group position={[HEATER_X, 0, 0]}>
        {Arr.map(ENDS, (side) => (
          <group key={side} position={[(side * SPAN) / 2, 0, 0]}>
            <mesh castShadow position={[0, 0.2, 0]} receiveShadow>
              <boxGeometry args={[0.1, 0.4, 0.36]} />
              <meshPhysicalMaterial
                clearcoat={0.7}
                clearcoatRoughness={0.2}
                color={APPARATUS_COLORS.porcelain}
                roughness={0.32}
              />
            </mesh>
            <mesh castShadow position={[0, 0.015, 0.06]} receiveShadow>
              <boxGeometry args={[0.16, 0.03, 0.62]} />
              <MetalMaterial
                color={APPARATUS_COLORS.caseSteel}
                roughness={0.4}
              />
            </mesh>
          </group>
        ))}
        <mesh
          castShadow
          position={[0, 0.2, -0.02]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry
            args={[0.19, 0.19, SPAN - 0.1, 48, 1, true, Math.PI, Math.PI]}
          />
          <meshPhysicalMaterial
            color={QUANTUM_COLORS.aluminium}
            metalness={1}
            roughness={0.12}
            side={DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0.2, 0.02]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.028, 0.028, SPAN - 0.1, 20]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.ceramic}
            roughness={0.7}
          />
        </mesh>
        <group position={[0, 0.2, 0.02]}>
          <HeatingCoil
            glow={glow}
            length={SPAN - 0.16}
            radius={0.046}
            turns={34}
          />
        </group>
        {Arr.map(GUARD, (y) => (
          <mesh
            key={y}
            position={[0, y + 0.01, 0.185]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.006, 0.006, SPAN - 0.1, 8]} />
            <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.25} />
          </mesh>
        ))}
        <Tag position={[-0.25, 0.66, 0]}>
          <InlineMath math={`P=${quantity(power, "\\text{ W}", 0)}`} />
        </Tag>
        <Tag position={[SPAN / 2 - 0.1, -0.02, 0.5]}>
          <InlineMath
            math={`${quantity(ratedVoltage, "\\text{ V}", 0)},\\ ${quantity(rated, "\\text{ W}", 0)}`}
          />
        </Tag>
      </group>
      <Lead
        color={APPARATUS_COLORS.leadRed}
        flow={current * DRIFT}
        points={LIVE}
      />
      <Lead
        color={APPARATUS_COLORS.leadBlack}
        flow={current * DRIFT}
        points={NEUTRAL}
      />
    </group>
  );
}

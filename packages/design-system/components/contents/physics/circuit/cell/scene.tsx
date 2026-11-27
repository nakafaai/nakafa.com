import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import { OakBoard } from "@repo/design-system/components/contents/physics/bench/board";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { DryCell } from "@repo/design-system/components/contents/physics/bench/cell";
import { Lead } from "@repo/design-system/components/contents/physics/bench/lead";
import { Meter } from "@repo/design-system/components/contents/physics/bench/meter";
import { Resistor } from "@repo/design-system/components/contents/physics/bench/resistor";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";

const CELL = [-0.55, 0, 0.32] as const;
const METER = [0.5, 0, -0.38] as const;
const LOAD = [0.72, 0, 0.36] as const;
/** How fast the charge markers of one ampere drift, in scene units a second. */
const DRIFT = 0.8;

const TAP_RED = [
  [CELL[0] + 0.42, 0.09, CELL[2]],
  [CELL[0] + 0.6, 0.035, 0.02],
  [METER[0] + 0.3, 0.035, METER[2] + 0.44],
  [METER[0] + 0.175, 0.11, METER[2] + 0.25],
] as const;
const TAP_BLACK = [
  [CELL[0] - 0.42, 0.09, CELL[2]],
  [CELL[0] - 0.4, 0.035, -0.1],
  [METER[0] - 0.5, 0.035, METER[2] + 0.36],
  [METER[0] - 0.175, 0.11, METER[2] + 0.25],
] as const;
const OUT = [
  [CELL[0] + 0.42, 0.09, CELL[2]],
  [0.2, 0.035, CELL[2] + 0.07],
  [LOAD[0] - 0.25, 0.11, LOAD[2]],
] as const;
const BACK = [
  [LOAD[0] + 0.25, 0.11, LOAD[2]],
  [LOAD[0] + 0.36, 0.035, 0.56],
  [0.1, 0.03, 0.68],
  [CELL[0] - 0.5, 0.035, 0.6],
  [CELL[0] - 0.42, 0.09, CELL[2]],
] as const;

/**
 * The circuit on its oak board: a dry cell in its holder, a moving-coil
 * voltmeter across the cell's terminals, and the chosen resistor in the loop.
 * The voltmeter's needle stands at the terminal voltage, which falls as a
 * smaller resistor draws a larger current through the cell's own resistance.
 */
export function InternalResistanceScene({
  current,
  emf,
  resistance,
  voltage,
}: {
  readonly current: number;
  readonly emf: number;
  readonly resistance: number;
  readonly voltage: number;
}) {
  const quantity = useQuantity();

  return (
    <group>
      <BenchCamera
        narrow={[0.1, 2.5, 4.1]}
        target={[0.05, 0.2, 0]}
        wide={[0.1, 2, 3.45]}
      />
      <SeamlessBenchSurface />
      <OakBoard depth={1.7} width={2.6}>
        <group position={CELL}>
          <DryCell />
        </group>
        <Tag position={[CELL[0], 0.46, CELL[2]]}>
          <InlineMath math="E,\ r" />
        </Tag>
        <group position={METER} scale={1.25}>
          <Meter share={voltage / Math.ceil(emf)}>
            <InlineMath math={`V=${quantity(voltage, "\\text{ V}", 2)}`} />
          </Meter>
        </group>
        <group position={LOAD}>
          <Resistor />
        </group>
        <Tag position={[LOAD[0], 0.34, LOAD[2]]}>
          <InlineMath math={`R=${quantity(resistance, "\\,\\Omega", 1)}`} />
        </Tag>
        <Lead
          color={APPARATUS_COLORS.leadRed}
          points={TAP_RED}
          radius={0.016}
        />
        <Lead
          color={APPARATUS_COLORS.leadBlack}
          points={TAP_BLACK}
          radius={0.016}
        />
        <Lead
          color={APPARATUS_COLORS.leadRed}
          flow={current * DRIFT}
          points={OUT}
        />
        <Lead
          color={APPARATUS_COLORS.leadBlack}
          flow={current * DRIFT}
          points={BACK}
        />
      </OakBoard>
    </group>
  );
}

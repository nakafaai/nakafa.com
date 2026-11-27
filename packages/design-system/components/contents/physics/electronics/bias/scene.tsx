import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import { OakBoard } from "@repo/design-system/components/contents/physics/bench/board";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { DryCell } from "@repo/design-system/components/contents/physics/bench/cell";
import { Lead } from "@repo/design-system/components/contents/physics/bench/lead";
import { Meter } from "@repo/design-system/components/contents/physics/bench/meter";
import { Resistor } from "@repo/design-system/components/contents/physics/bench/resistor";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import { Transistor } from "@repo/design-system/components/contents/physics/electronics/parts";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";

/** The base loop: from the base supply through the base resistor into the base, and home from the emitter. */
const BASE_IN = [
  [-1.15, 0.09, -0.12],
  [-0.95, 0.035, 0.1],
  [-0.7, 0.11, 0.3],
] as const;
const BASE_ON = [
  [-0.2, 0.11, 0.3],
  [-0.07, 0.05, 0.34],
  [0.06, 0.09, 0.3],
] as const;
const BASE_HOME = [
  [0.5, 0.09, 0.47],
  [0.2, 0.035, 0.74],
  [-0.6, 0.035, 0.8],
  [-1.15, 0.09, 0.72],
] as const;
/** The collector loop: from the collector supply through the collector resistor into the collector, and home from the emitter. */
const COLLECTOR_IN = [
  [0.53, 0.09, -0.72],
  [0.44, 0.05, -0.64],
  [0.5, 0.11, -0.55],
] as const;
const COLLECTOR_ON = [
  [0.5, 0.11, -0.05],
  [0.56, 0.05, 0.04],
  [0.5, 0.09, 0.13],
] as const;
const COLLECTOR_HOME = [
  [0.5, 0.09, 0.47],
  [0.85, 0.035, 0.68],
  [1.36, 0.035, 0.52],
  [1.5, 0.035, -0.3],
  [1.37, 0.09, -0.72],
] as const;
/** The voltmeter's own leads, from the collector and the emitter. */
const PROBE_HIGH = [
  [0.5, 0.09, 0.13],
  [0.8, 0.035, 0.02],
  [1.18, 0.11, 0.22],
] as const;
const PROBE_LOW = [
  [0.5, 0.09, 0.47],
  [0.74, 0.035, 0.4],
  [0.83, 0.11, 0.22],
] as const;

/**
 * The biased transistor on its oak board: the base supply and base resistor
 * on the left, the collector supply and collector resistor behind, and a
 * voltmeter across the collector and emitter. Charge markers drift round the
 * small base loop and the far larger collector loop while the card plays, and
 * the voltmeter falls toward zero as the transistor runs into saturation.
 */
export function TransistorBiasScene({
  baseFlow,
  collectorEmitter,
  collectorFlow,
  collectorSupply,
}: {
  /** The base current times the gain, as a share of the largest collector current the supply could drive. */
  readonly baseFlow: number;
  readonly collectorEmitter: number;
  /** The collector current as a share of the largest the supply could drive. */
  readonly collectorFlow: number;
  readonly collectorSupply: number;
}) {
  const quantity = useQuantity();

  return (
    <group>
      <BenchCamera
        narrow={[0.1, 3.2, 5.2]}
        target={[0.1, 0.16, 0]}
        wide={[0.1, 2.45, 4.05]}
      />
      <SeamlessBenchSurface />
      <group position={[0.1, 0, 0]}>
        <OakBoard depth={2.1} width={3.4} />
      </group>
      <group position={[0, 0.07, 0]}>
        <group position={[-1.15, 0, 0.3]} rotation={[0, Math.PI / 2, 0]}>
          <DryCell />
        </group>
        <Tag position={[-1.15, 0.46, 0.3]}>
          <InlineMath math="V_{BB}" />
        </Tag>
        <group position={[-0.45, 0, 0.3]}>
          <Resistor />
        </group>
        <Tag position={[-0.45, 0.34, 0.3]}>
          <InlineMath math="R_B" />
        </Tag>
        <group position={[0.3, 0, 0.3]}>
          <Transistor />
        </group>
        <group position={[0.5, 0, -0.3]} rotation={[0, Math.PI / 2, 0]}>
          <Resistor />
        </group>
        <Tag position={[0.28, 0.3, -0.3]}>
          <InlineMath math="R_C" />
        </Tag>
        <group position={[0.95, 0, -0.72]} rotation={[0, Math.PI, 0]}>
          <DryCell />
        </group>
        <Tag position={[0.35, 0.5, -0.78]}>
          <InlineMath math="V_{CC}" />
        </Tag>
        <group position={[1, 0, -0.03]} scale={1.2}>
          <Meter share={collectorEmitter / collectorSupply}>
            <InlineMath
              math={`V_{CE}=${quantity(collectorEmitter, "\\text{ V}", 2)}`}
            />
          </Meter>
        </group>
        <Lead
          color={APPARATUS_COLORS.leadRed}
          flow={baseFlow * 0.3}
          points={BASE_IN}
          radius={0.016}
        />
        <Lead
          color={APPARATUS_COLORS.leadYellow}
          flow={baseFlow * 0.3}
          points={BASE_ON}
          radius={0.016}
        />
        <Lead
          color={APPARATUS_COLORS.leadBlack}
          flow={baseFlow * 0.3}
          points={BASE_HOME}
          radius={0.016}
        />
        <Lead
          color={APPARATUS_COLORS.leadRed}
          flow={collectorFlow * 1.1}
          points={COLLECTOR_IN}
        />
        <Lead
          color={APPARATUS_COLORS.leadRed}
          flow={collectorFlow * 1.1}
          points={COLLECTOR_ON}
        />
        <Lead
          color={APPARATUS_COLORS.leadBlack}
          flow={collectorFlow * 1.1}
          points={COLLECTOR_HOME}
        />
        <Lead
          color={APPARATUS_COLORS.leadGreen}
          points={PROBE_HIGH}
          radius={0.012}
        />
        <Lead
          color={APPARATUS_COLORS.leadBlue}
          points={PROBE_LOW}
          radius={0.012}
        />
      </group>
    </group>
  );
}

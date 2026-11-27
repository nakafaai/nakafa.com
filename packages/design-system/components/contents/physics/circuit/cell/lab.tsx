import { Trace } from "@repo/design-system/components/contents/physics/bench/trace";
import { InternalResistanceScene } from "@repo/design-system/components/contents/physics/circuit/cell/scene";
import {
  cellFromReadings,
  drive,
} from "@repo/design-system/components/contents/physics/circuit/current";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface InternalResistanceLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    current: ReactNode;
    emf: ReactNode;
    internal: ReactNode;
    resistor: string;
    terminal: ReactNode;
    viewLabel: string;
  };
  /** Two or more measured readings: each external resistance in ohms and the terminal voltage in volts. */
  readings: readonly [
    { readonly resistance: number; readonly voltage: number },
    { readonly resistance: number; readonly voltage: number },
    ...{ readonly resistance: number; readonly voltage: number }[],
  ];
  title: NonNullable<ReactNode>;
  /** A further resistance, in ohms, whose current the readings let you predict. */
  trial: number;
}

/**
 * A dry cell with a voltmeter across its terminals drives one resistor at a
 * time. Two readings fix the cell's e.m.f. and internal resistance: they lie
 * on the line V = E − I r. Swap the resistor and watch the operating point
 * slide along that line to where the resistor's own line V = I R meets it.
 */
export function InternalResistanceLab({
  description,
  labels,
  readings,
  title,
  trial,
}: InternalResistanceLabProps) {
  const quantity = useQuantity();
  const cell = cellFromReadings(readings[0], readings[1]);
  const options = Arr.dedupe([
    ...Arr.map(readings, (reading) => reading.resistance),
    trial,
  ]);
  const [resistance, setResistance] = useState(readings[0].resistance);
  const now = drive(cell, resistance);
  /** The largest current the chart shows, and how far along it the cell's line runs before it reaches zero volts. */
  const most =
    Math.max(...Arr.map(options, (option) => drive(cell, option).current)) *
    1.25;
  const reach = Math.min(most, cell.emf / cell.internal);

  return (
    <VisualCard
      onReset={() => {
        setResistance(readings[0].resistance);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.resistor}
          onValueChange={(value) => setResistance(Number(value))}
          type="single"
          value={String(resistance)}
          variant="outline"
        >
          {Arr.map(options, (option) => (
            <ToggleGroupItem key={option} value={String(option)}>
              <InlineMath math={`R=${quantity(option, "\\,\\Omega", 1)}`} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={2.5} setting="lab">
          <Suspense fallback={null}>
            <InternalResistanceScene
              current={now.current}
              emf={cell.emf}
              resistance={resistance}
              voltage={now.voltage}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <Trace
          compare={{
            label: <InlineMath math="V=IR" />,
            points: [
              { x: 0, y: 0 },
              {
                x: Math.min(most, (cell.emf * 1.15) / resistance),
                y: Math.min(most * resistance, cell.emf * 1.15),
              },
            ],
          }}
          curve={{
            label: <InlineMath math="V=E-Ir" />,
            points: [
              { x: 0, y: cell.emf },
              { x: reach, y: cell.emf - reach * cell.internal },
            ],
          }}
          mark={{
            label: <InlineMath math="(I,\ V)" />,
            point: { x: now.current, y: now.voltage },
          }}
          x={{ caption: "I\\ (\\text{A})", domain: [0, most] }}
          y={{ caption: "V\\ (\\text{V})", domain: [0, cell.emf * 1.15] }}
        />
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.current}
            value={<InlineMath math={quantity(now.current, "\\text{ A}", 2)} />}
          />
          <VisualFactTabular
            label={labels.terminal}
            value={<InlineMath math={quantity(now.voltage, "\\text{ V}", 2)} />}
          />
          <VisualFactTabular
            label={labels.emf}
            value={<InlineMath math={quantity(cell.emf, "\\text{ V}", 2)} />}
          />
          <VisualFactTabular
            label={labels.internal}
            value={
              <InlineMath math={quantity(cell.internal, "\\,\\Omega", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

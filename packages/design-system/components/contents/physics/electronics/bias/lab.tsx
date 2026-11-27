import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { TransistorBiasScene } from "@repo/design-system/components/contents/physics/electronics/bias/scene";
import { transistorBias } from "@repo/design-system/components/contents/physics/electronics/logic";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface TransistorBiasLabProps {
  /** The base resistor the lab starts with, in kilohms. */
  base: number;
  /** The base supply voltage, in volts. */
  baseSupply: number;
  /** The collector resistor, in kilohms. */
  collector: number;
  /** The collector supply voltage, in volts. */
  collectorSupply: number;
  description: NonNullable<ReactNode>;
  /** The collector current over the base current. */
  gain: number;
  labels: {
    base: ReactNode;
    baseCurrent: ReactNode;
    baseName: string;
    collectorCurrent: ReactNode;
    collectorEmitter: ReactNode;
    viewLabel: string;
  };
  /** The base-emitter voltage, in volts. */
  threshold: number;
  title: NonNullable<ReactNode>;
}

/**
 * An npn transistor with a base resistor and a collector resistor. The base
 * resistor takes the base supply less the base-emitter voltage, which sets a
 * small base current; the collector current is that many times larger; and
 * the collector supply is shared between the collector resistor and the
 * transistor. Shrink the base resistor and watch the transistor run into
 * saturation.
 */
export function TransistorBiasLab({
  base: start,
  baseSupply,
  collector,
  collectorSupply,
  description,
  gain,
  labels,
  title,
  threshold,
}: TransistorBiasLabProps) {
  const quantity = useQuantity();
  const [base, setBase] = useState(start);
  const bias = transistorBias({
    base: base * 1000,
    baseSupply,
    collector: collector * 1000,
    collectorSupply,
    gain,
    threshold,
  });

  /** The largest collector current the chart of flows is measured against: a little above what the supply drives through the collector resistor alone. */
  const most = (collectorSupply / (collector * 1000)) * 1.2;

  return (
    <VisualCard
      onReset={() => {
        setBase(start);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.base}</span>}
          max={Math.max(500, start * 3)}
          min={10}
          name={labels.baseName}
          onValueChange={setBase}
          readout={<InlineMath math={quantity(base, "\\text{ k}\\Omega", 0)} />}
          step={10}
          value={base}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={2.8} setting="lab">
          <Suspense fallback={null}>
            <TransistorBiasScene
              baseFlow={(bias.baseCurrent * gain) / most}
              collectorEmitter={bias.collectorEmitter}
              collectorFlow={bias.collectorCurrent / most}
              collectorSupply={collectorSupply}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.baseCurrent}
            value={
              <InlineMath
                math={quantity(bias.baseCurrent * 1e6, "\\ \\mu\\text{A}", 1)}
              />
            }
          />
          <VisualFactTabular
            label={labels.collectorCurrent}
            value={
              <InlineMath
                math={quantity(bias.collectorCurrent * 1000, "\\text{ mA}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.collectorEmitter}
            value={
              <InlineMath
                math={quantity(bias.collectorEmitter, "\\text{ V}", 2)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

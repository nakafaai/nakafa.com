import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { dividerVoltage } from "@repo/design-system/components/contents/physics/electronics/logic";
import {
  Lamp,
  TransistorSwitchScene,
} from "@repo/design-system/components/contents/physics/electronics/switch/scene";
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

/**
 * The resistance of a typical light-dependent resistor, in kilohms: about
 * 1 kΩ in bright light and 100 kΩ in the dark, falling steadily on a
 * logarithmic scale as the light grows.
 */
const LDR = { bright: 1, dark: 100 } as const;

/** The LDR's resistance, in kilohms, at a light level from 0 (dark) to 1 (bright). */
function ldrResistance(light: number) {
  return LDR.dark * (LDR.bright / LDR.dark) ** light;
}

/** The light level, from 0 to 1, at which a divider with `resistor` kilohms above the LDR reaches the switching voltage. */
function switchingLight(supply: number, threshold: number, resistor: number) {
  const needed = (threshold * resistor) / (supply - threshold);
  return Math.min(
    Math.max(Math.log(needed / LDR.dark) / Math.log(LDR.bright / LDR.dark), 0),
    1
  );
}

interface TransistorSwitchLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    base: ReactNode;
    ldr: ReactNode;
    light: ReactNode;
    lightName: string;
    resistor: ReactNode;
    resistorName: string;
    switching: ReactNode;
    viewLabel: string;
  };
  /** The fixed resistor above the LDR the lab starts with, in kilohms. */
  resistor: number;
  /** The supply voltage, in volts. */
  supply: number;
  /** The base voltage at which the transistor switches on, in volts. */
  threshold: number;
  title: NonNullable<ReactNode>;
}

/**
 * An automatic lamp: a fixed resistor above a light-dependent resistor
 * shares the supply, and the share across the LDR drives the transistor's
 * base. As the light fades the LDR's resistance climbs, its share grows, and
 * once the base reaches the switching voltage the bulb lights. Make the
 * fixed resistor smaller and watch the switching point move to brighter
 * light.
 */
export function TransistorSwitchLab({
  description,
  labels,
  resistor: start,
  supply,
  title,
  threshold,
}: TransistorSwitchLabProps) {
  const quantity = useQuantity();
  const [resistor, setResistor] = useState(start);
  const [light, setLight] = useState(0.6);
  const ldr = ldrResistance(light);
  const base = dividerVoltage(supply, resistor, ldr);
  const switching = switchingLight(supply, threshold, resistor);

  return (
    <VisualCard
      onReset={() => {
        setResistor(start);
        setLight(0.6);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-4">
          <LabSlider
            label={<span>{labels.light}</span>}
            max={100}
            min={0}
            name={labels.lightName}
            onValueChange={(value) => setLight(value / 100)}
            readout={<InlineMath math={quantity(light * 100, "\\%", 0)} />}
            step={1}
            value={Math.round(light * 100)}
          />
          <LabSlider
            label={<span>{labels.resistor}</span>}
            max={Math.max(200, start * 2)}
            min={5}
            name={labels.resistorName}
            onValueChange={setResistor}
            readout={
              <InlineMath math={quantity(resistor, "\\text{ k}\\Omega", 0)} />
            }
            step={5}
            value={resistor}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.7} setting="lab">
          <Suspense fallback={null}>
            <TransistorSwitchScene base={base} on={base >= threshold}>
              <Lamp light={light} />
            </TransistorSwitchScene>
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.ldr}
            value={<InlineMath math={quantity(ldr, "\\text{ k}\\Omega", 1)} />}
          />
          <VisualFactTabular
            label={labels.base}
            value={<InlineMath math={quantity(base, "\\text{ V}", 2)} />}
          />
          <VisualFactTabular
            label={labels.switching}
            value={<InlineMath math={quantity(switching * 100, "\\%", 0)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { heaterOnSupply } from "@repo/design-system/components/contents/physics/circuit/current";
import { HeaterSupplyScene } from "@repo/design-system/components/contents/physics/circuit/heater/scene";
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

interface HeaterSupplyLabProps {
  description: NonNullable<ReactNode>;
  /** How long the heater runs, in hours. */
  hours: number;
  labels: {
    energy: ReactNode;
    power: ReactNode;
    resistance: ReactNode;
    supply: ReactNode;
    supplyName: string;
    viewLabel: string;
  };
  /** The power on the heater's label, in watts. */
  ratedPower: number;
  /** The voltage on the heater's label, in volts. */
  ratedVoltage: number;
  /** The supply voltage the lab starts at, in volts. */
  supplyVoltage: number;
  title: NonNullable<ReactNode>;
}

/**
 * A heater whose label gives its voltage and power, plugged into a supply of
 * another voltage. Its coil keeps the resistance the label implies, R = V²/P,
 * so on a lower voltage it draws less current and far less power, and its
 * coil glows dimmer. Change the supply and read the power and the energy over
 * the running time.
 */
export function HeaterSupplyLab({
  description,
  hours,
  labels,
  ratedPower,
  ratedVoltage,
  supplyVoltage,
  title,
}: HeaterSupplyLabProps) {
  const quantity = useQuantity();
  const [supply, setSupply] = useState(supplyVoltage);
  const heater = heaterOnSupply(
    { power: ratedPower, voltage: ratedVoltage },
    supply,
    hours
  );

  return (
    <VisualCard
      onReset={() => {
        setSupply(supplyVoltage);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.supply}</span>}
          max={Math.ceil(ratedVoltage * 1.1)}
          min={0}
          name={labels.supplyName}
          onValueChange={setSupply}
          readout={<InlineMath math={quantity(supply, "\\text{ V}", 0)} />}
          step={10}
          value={supply}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={2.6} setting="lab">
          <Suspense fallback={null}>
            <HeaterSupplyScene
              current={supply / heater.resistance}
              power={heater.power}
              rated={ratedPower}
              ratedVoltage={ratedVoltage}
              supply={supply}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.resistance}
            value={
              <InlineMath math={quantity(heater.resistance, "\\,\\Omega", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.power}
            value={
              <InlineMath math={quantity(heater.power, "\\text{ W}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.energy}
            value={
              <InlineMath math={quantity(heater.energy, "\\text{ kWh}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

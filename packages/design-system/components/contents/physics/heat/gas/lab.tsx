import { GasPistonScene } from "@repo/design-system/components/contents/physics/heat/gas/scene";
import {
  gasPressure,
  KELVIN,
} from "@repo/design-system/components/contents/physics/heat/thermal";
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
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

const StageSchema = Schema.Literals(["start", "compressed", "heated"]);
type Stage = typeof StageSchema.Type;

interface GasPistonLabProps {
  description: NonNullable<ReactNode>;
  /** The temperature the gas is heated to, in degrees Celsius. */
  finalTemperature: number;
  labels: {
    pressure: ReactNode;
    stage: string;
    stages: Record<Stage, ReactNode>;
    temperature: ReactNode;
    viewLabel: string;
    volume: ReactNode;
  };
  /** The starting pressure of the gas, in kilopascals. */
  pressure: number;
  /** The starting temperature of the gas, in degrees Celsius. */
  temperature: number;
  title: NonNullable<ReactNode>;
  /** The final volume as a fraction of the starting volume. */
  volumeRatio: number;
}

/**
 * A fixed mass of gas in a cylinder, taken through its change one step at a
 * time: first squeezed to its new volume at the starting temperature, then
 * heated at that volume. The molecules crowd closer when the piston moves in
 * and speed up when the gas is heated, and the gauge reads the pressure after
 * each step.
 */
export function GasPistonLab({
  description,
  finalTemperature,
  labels,
  pressure,
  temperature,
  title,
  volumeRatio,
}: GasPistonLabProps) {
  const quantity = useQuantity();
  const [stage, setStage] = useState<Stage>("start");
  const isStage = Schema.is(StageSchema);
  const volume = stage === "start" ? 1 : volumeRatio;
  const celsius = stage === "heated" ? finalTemperature : temperature;
  const now = gasPressure(pressure, volume, { from: temperature, to: celsius });
  const full =
    Math.ceil(
      (gasPressure(pressure, volumeRatio, {
        from: temperature,
        to: finalTemperature,
      }) *
        1.25) /
        50
    ) * 50;

  return (
    <VisualCard
      onReset={() => {
        setStage("start");
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.stage}
          gridColumns="3"
          onValueChange={(value) => {
            if (isStage(value)) {
              setStage(value);
            }
          }}
          type="single"
          value={stage}
          variant="outline"
        >
          {Arr.map(StageSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.stages[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={2.8} setting="lab">
          <Suspense fallback={null}>
            <GasPistonScene
              full={full}
              heated={stage === "heated"}
              kelvin={celsius + KELVIN}
              pressure={now}
              volume={volume}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.volume}
            value={<InlineMath math={`${quantity(volume, "", 2)}\\,V_1`} />}
          />
          <VisualFactTabular
            label={labels.temperature}
            value={
              <InlineMath math={quantity(celsius + KELVIN, "\\text{ K}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.pressure}
            value={<InlineMath math={quantity(now, "\\text{ kPa}", 0)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

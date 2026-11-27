import { Trace } from "@repo/design-system/components/contents/physics/bench/trace";
import { HeatingCurveScene } from "@repo/design-system/components/contents/physics/heat/curve/scene";
import {
  heatingTemperature,
  latentFromHeating,
} from "@repo/design-system/components/contents/physics/heat/thermal";
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
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface HeatingCurveLabProps {
  description: NonNullable<ReactNode>;
  /** The temperature the liquid reaches, in degrees Celsius. */
  finalTemperature: number;
  labels: {
    latent: ReactNode;
    power: ReactNode;
    viewLabel: string;
  };
  /** The specific heat capacity of the liquid, in J kg⁻¹ °C⁻¹. */
  liquidHeat: number;
  /** The mass of the sample, in kilograms. */
  mass: number;
  /** The melting point, in degrees Celsius. */
  meltingPoint: number;
  /** How long the solid takes to melt, in minutes. */
  meltMinutes: number;
  title: NonNullable<ReactNode>;
  /** How long the liquid takes to warm from the melting point to the final temperature, in minutes. */
  warmMinutes: number;
}

/**
 * An immersion heater of constant power melts a solid in a beaker and then
 * warms the liquid. While the solid melts the thermometer stays put and the
 * graph runs flat; once it has all melted the temperature climbs. The same
 * heater works through both stretches, so the warming stretch gives the
 * power, and the power times the melting time gives the latent heat.
 */
export function HeatingCurveLab({
  description,
  finalTemperature,
  labels,
  liquidHeat,
  mass,
  meltMinutes,
  meltingPoint,
  title,
  warmMinutes,
}: HeatingCurveLabProps) {
  const quantity = useQuantity();
  const [progress, setProgress] = useState(0);
  const sample = latentFromHeating({
    mass,
    melt: meltMinutes * 60,
    rise: finalTemperature - meltingPoint,
    specific: liquidHeat,
    warm: warmMinutes * 60,
  });
  const heating = {
    melt: meltMinutes,
    melting: meltingPoint,
    top: finalTemperature,
    warm: warmMinutes,
  };
  const total = meltMinutes + warmMinutes;

  return (
    <VisualCard
      onReset={() => {
        setProgress(0);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.6} setting="lab">
          <Suspense fallback={null}>
            <HeatingCurveScene
              melt={meltMinutes}
              melting={meltingPoint}
              onProgress={setProgress}
              progress={progress}
              top={finalTemperature}
              warm={warmMinutes}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <Trace
          curve={{
            label: <InlineMath math="\theta(t)" />,
            points: [
              { x: 0, y: meltingPoint },
              { x: meltMinutes, y: meltingPoint },
              { x: total, y: finalTemperature },
            ],
          }}
          mark={{
            label: <InlineMath math="(t,\,\theta)" />,
            point: {
              x: progress * total,
              y: heatingTemperature(heating, progress),
            },
          }}
          x={{ caption: "t\\,(\\text{min})", domain: [0, total] }}
          y={{
            caption: "\\theta\\,(^\\circ\\text{C})",
            domain: [
              Math.floor((meltingPoint - 20) / 10) * 10,
              finalTemperature,
            ],
          }}
        />
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.power}
            value={
              <InlineMath math={quantity(sample.power, "\\text{ W}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.latent}
            value={
              <InlineMath
                math={`${quantity(sample.latent / 10 ** Math.floor(Math.log10(sample.latent)), "", 2)}\\times10^{${Math.floor(Math.log10(sample.latent))}}\\text{ J kg}^{-1}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

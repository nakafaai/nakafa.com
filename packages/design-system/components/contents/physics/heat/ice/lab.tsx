import { Trace } from "@repo/design-system/components/contents/physics/bench/trace";
import {
  IceMeltingScene,
  mixingShare,
} from "@repo/design-system/components/contents/physics/heat/ice/scene";
import { meltIce } from "@repo/design-system/components/contents/physics/heat/thermal";
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

interface IceMeltingLabProps {
  description: NonNullable<ReactNode>;
  /** The mass of ice at its melting point, in grams. */
  iceMass: number;
  labels: {
    final: ReactNode;
    given: ReactNode;
    melt: ReactNode;
    viewLabel: string;
  };
  /** The specific latent heat of fusion of ice, in J kg⁻¹. */
  latentHeat: number;
  /** The specific heat capacity of water, in J kg⁻¹ °C⁻¹. */
  specificHeat: number;
  title: NonNullable<ReactNode>;
  /** The mass of warm water, in grams. */
  waterMass: number;
  /** The starting temperature of the water, in degrees Celsius. */
  waterTemperature: number;
}

/**
 * An ice cube at 0 °C dropped into warm water in an insulated cup. The water
 * cools and gives out heat Q₁; the ice takes in Q₂ to melt and then to warm
 * up. Watch the cube shrink and the thermometer fall while the chart follows
 * the heat given out, up to the temperature where it matches the heat taken
 * in.
 */
export function IceMeltingLab({
  description,
  iceMass,
  labels,
  latentHeat,
  specificHeat,
  title,
  waterMass,
  waterTemperature,
}: IceMeltingLabProps) {
  const quantity = useQuantity();
  const [progress, setProgress] = useState(0);
  const water = waterMass / 1000;
  const ice = iceMass / 1000;
  const mixture = meltIce({
    ice,
    latent: latentHeat,
    specific: specificHeat,
    temperature: waterTemperature,
    water,
  });
  /** The heat the water has given out once it has cooled to `temperature`, in kilojoules. */
  const given = (temperature: number) =>
    (water * specificHeat * (waterTemperature - temperature)) / 1000;
  /** The heat the ice needs to melt and then warm to `temperature`, in kilojoules. */
  const taken = (temperature: number) =>
    (ice * latentHeat + ice * specificHeat * temperature) / 1000;
  const shown =
    waterTemperature +
    (mixture.final - waterTemperature) * mixingShare(progress);

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
            <IceMeltingScene
              final={mixture.final}
              melted={mixture.melted / ice}
              onProgress={setProgress}
              progress={progress}
              start={waterTemperature}
              water={waterMass / (waterMass + iceMass)}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <Trace
          compare={{
            label: <InlineMath math="Q_2" />,
            points: [
              { x: 0, y: taken(0) },
              { x: waterTemperature, y: taken(waterTemperature) },
            ],
          }}
          curve={{
            label: <InlineMath math="Q_1" />,
            points: [
              { x: 0, y: given(0) },
              { x: waterTemperature, y: 0 },
            ],
          }}
          mark={{
            label: <InlineMath math="(\theta,\,Q_1)" />,
            point: { x: shown, y: given(shown) },
          }}
          x={{
            caption: "\\theta\\,(^\\circ\\text{C})",
            domain: [0, waterTemperature],
          }}
          y={{
            caption: "Q\\,(\\text{kJ})",
            domain: [0, Math.max(given(0), taken(waterTemperature))],
          }}
        />
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.melt}
            value={
              <InlineMath math={quantity(mixture.melt, "\\text{ J}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.given}
            value={
              <InlineMath math={quantity(mixture.given, "\\text{ J}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.final}
            value={
              <InlineMath
                math={quantity(mixture.final, "^\\circ\\text{C}", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

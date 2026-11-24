import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { LimitingFactor } from "@repo/design-system/components/contents/biology/saturation/model";
import {
  evaluateSaturation,
  productsAt,
} from "@repo/design-system/components/contents/biology/saturation/model";
import { SaturationScene } from "@repo/design-system/components/contents/biology/saturation/scene";
import { SaturationTrace } from "@repo/design-system/components/contents/biology/saturation/trace";
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
import {
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { ENZYME_COLORS } from "@repo/design-system/lib/material/enzyme";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function EnzymeSaturationLab({
  description,
  enzymes: enzymeRange,
  labels,
  substrates: substrateRange,
  title,
  turnover,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly enzymes: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly labels: {
    readonly busy: ReactNode;
    readonly curve: ReactNode;
    readonly enzymes: string;
    readonly limiting: ReactNode;
    readonly limits: Readonly<Record<LimitingFactor, ReactNode>>;
    readonly parts: Readonly<
      Record<"enzyme" | "substrate" | "product", string>
    >;
    readonly rate: ReactNode;
    readonly substrates: string;
    readonly time: string;
    readonly view: string;
  };
  readonly substrates: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
  readonly turnover: number;
}) {
  const [enzymeCount, setEnzymeCount] = useState(enzymeRange.value);
  const [substrateCount, setSubstrateCount] = useState(substrateRange.value);
  const [seconds, setSeconds] = useState(4);
  const quantity = useQuantity();

  const state = evaluateSaturation(enzymeCount, substrateCount, turnover);
  const productCount = productsAt(state.rate, seconds, substrateCount);
  const maxRate = enzymeRange.max * turnover;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setEnzymeCount(enzymeRange.value);
          setSubstrateCount(substrateRange.value);
          setSeconds(4);
        }}
      />

      <VisualCardToolbar>
        <VisualSlider
          heading={labels.enzymes}
          label={labels.enzymes}
          max={enzymeRange.max}
          min={enzymeRange.min}
          onValueChange={setEnzymeCount}
          readout={enzymeCount}
          step={1}
          value={enzymeCount}
        />
        <VisualSlider
          heading={labels.substrates}
          label={labels.substrates}
          max={substrateRange.max}
          min={substrateRange.min}
          onValueChange={setSubstrateCount}
          readout={substrateCount}
          step={1}
          value={substrateCount}
        />
        <VisualSlider
          heading={labels.time}
          label={labels.time}
          max={20}
          min={0}
          onValueChange={setSeconds}
          pauseOnChange
          readout={<InlineMath math={quantity(seconds, "\\text{ s}", 0)} />}
          step={1}
          value={seconds}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.2} setting="studio">
          <Suspense fallback={null}>
            <SaturationScene
              busySites={state.busySites}
              enzymeCount={enzymeCount}
              parts={labels.parts}
              productCount={productCount}
              substrateCount={substrateCount}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <SaturationTrace
          caption={labels.curve}
          currentRate={state.rate}
          currentSubstrates={substrateCount}
          enzymes={enzymeCount}
          maxRate={maxRate}
          maxSubstrates={substrateRange.max}
          turnover={turnover}
        />
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.busy}
            value={`${state.busySites} / ${enzymeCount}`}
          />
          <VisualFactTabular
            label={labels.rate}
            value={
              <InlineMath math={quantity(state.rate, "\\text{ s}^{-1}", 1)} />
            }
          />
          <VisualFactIndicator
            indicatorColor={
              state.limiting === "enzyme"
                ? ENZYME_COLORS.enzymeBusy
                : ENZYME_COLORS.substrateDot
            }
            label={labels.limiting}
            value={labels.limits[state.limiting]}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

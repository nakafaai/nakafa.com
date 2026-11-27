import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type {
  IndicatorKind,
  PhSample,
} from "@repo/design-system/components/contents/chemistry/indicator/model";
import { evaluatePhIndicator } from "@repo/design-system/components/contents/chemistry/indicator/model";
import { PhIndicatorScene } from "@repo/design-system/components/contents/chemistry/indicator/scene";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
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
import {
  VisualFact,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function PhIndicatorScaleLab({
  description,
  indicators,
  labels,
  samples,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly indicators: readonly [IndicatorKind, ...IndicatorKind[]];
  readonly labels: {
    readonly classification?: ReactNode;
    readonly indicator: string;
    readonly indicators: Readonly<Partial<Record<IndicatorKind, string>>>;
    readonly parts: Readonly<
      Record<"beaker" | "dropper" | "ionCloud" | "phStrip" | "solution", string>
    >;
    readonly phValue?: ReactNode;
    readonly sample: string;
    readonly samples: Readonly<
      Partial<
        Record<
          PhSample,
          { readonly formula: ReactNode; readonly name: ReactNode }
        >
      >
    >;
    readonly view: string;
  };
  readonly samples: readonly [PhSample, ...PhSample[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selectedSample, setSelectedSample] = useState<PhSample>(samples[0]);
  const [selectedInd, setSelectedInd] = useState<IndicatorKind>(indicators[0]);
  const quantity = useQuantity();

  const activeSample = Arr.contains(samples, selectedSample)
    ? selectedSample
    : samples[0];
  const activeInd = Arr.contains(indicators, selectedInd)
    ? selectedInd
    : indicators[0];
  const reading = evaluatePhIndicator(activeSample, activeInd);
  const sampleCopy = labels.samples[activeSample];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelectedSample(samples[0]);
          setSelectedInd(indicators[0]);
        }}
      />

      {samples.length > 1 || indicators.length > 1 ? (
        <VisualCardToolbar>
          {samples.length > 1 ? (
            <ToggleGroup
              aria-label={labels.sample}
              gridColumns={toggleColumns(samples.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(samples, (item) => item === next),
                  setSelectedSample
                );
              }}
              type="single"
              value={activeSample}
              variant="outline"
            >
              {Arr.map(samples, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.samples[id]?.name ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          {indicators.length > 1 ? (
            <ToggleGroup
              aria-label={labels.indicator}
              gridColumns={toggleColumns(indicators.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(indicators, (item) => item === next),
                  setSelectedInd
                );
              }}
              type="single"
              value={activeInd}
              variant="outline"
            >
              {Arr.map(indicators, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.indicators[id] ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
        </VisualCardToolbar>
      ) : null}

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.85} setting="lab">
          <Suspense fallback={null}>
            <PhIndicatorScene
              indicator={activeInd}
              parts={labels.parts}
              sample={activeSample}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {sampleCopy === undefined ? null : (
            <VisualFact label={labels.sample} value={sampleCopy.formula} />
          )}
          {labels.phValue === undefined ? null : (
            <VisualFactTabular
              label={labels.phValue}
              value={
                <InlineMath
                  math={`\\mathrm{pH}\\ ${quantity(reading.ph, "", 1)}`}
                />
              }
            />
          )}
          {labels.classification === undefined ? null : (
            <VisualFact
              label={labels.classification}
              value={labels.indicators[activeInd] ?? activeInd}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

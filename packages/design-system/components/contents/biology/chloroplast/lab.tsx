import type {
  ChloroplastStage,
  GasState,
  LimitingFactor,
} from "@repo/design-system/components/contents/biology/chloroplast/model";
import { evaluateChloroplast } from "@repo/design-system/components/contents/biology/chloroplast/model";
import { ChloroplastScene } from "@repo/design-system/components/contents/biology/chloroplast/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
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
  VisualFactIndicator,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr, Match, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function ChloroplastStageLab({
  co2,
  description,
  labels,
  light,
  stages,
  temperature,
  title,
}: {
  readonly co2: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly co2: string;
    readonly factors: Readonly<Record<LimitingFactor, string>>;
    readonly gasStates: Readonly<Record<GasState, string>>;
    readonly light: string;
    readonly limitingFactor?: ReactNode;
    readonly netGas?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "atp"
        | "co2"
        | "glucose"
        | "granum"
        | "nadph"
        | "oxygen"
        | "stroma"
        | "thylakoid"
        | "water",
        string
      >
    >;
    readonly site: ReactNode;
    readonly sites: Readonly<Partial<Record<ChloroplastStage, ReactNode>>>;
    readonly stage: string;
    readonly stages: Readonly<Partial<Record<ChloroplastStage, string>>>;
    readonly temperature: string;
    readonly view: string;
  };
  readonly light: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly stages: readonly [ChloroplastStage, ...ChloroplastStage[]];
  readonly temperature: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selectedStage, setSelectedStage] = useState<ChloroplastStage>(
    stages[0]
  );
  const [lightVal, setLightVal] = useState(light.value);
  const [co2Val, setCo2Val] = useState(co2.value);
  const [tempVal, setTempVal] = useState(temperature.value);

  const activeStage = Arr.contains(stages, selectedStage)
    ? selectedStage
    : stages[0];
  const reading = evaluateChloroplast({
    co2: co2Val,
    co2Max: co2.max,
    co2Min: co2.min,
    light: lightVal,
    lightMax: light.max,
    lightMin: light.min,
    temperature: tempVal,
    temperatureMax: temperature.max,
    temperatureMin: temperature.min,
  });
  const siteCopy = labels.sites[activeStage];
  const gasIndicator = Match.value(reading.gasState).pipe(
    Match.when("netRelease", () => FOLIAGE_COLORS.oxygenBubble),
    Match.when("compensation", () => FOLIAGE_COLORS.atpGlow),
    Match.when("netUptake", () => FOLIAGE_COLORS.co2Molecule),
    Match.exhaustive
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelectedStage(stages[0]);
          setLightVal(light.value);
          setCo2Val(co2.value);
          setTempVal(temperature.value);
        }}
      />

      <VisualCardToolbar>
        {stages.length > 1 ? (
          <ToggleGroup
            aria-label={labels.stage}
            gridColumns={toggleColumns(stages.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(stages, (item) => item === next),
                setSelectedStage
              );
            }}
            type="single"
            value={activeStage}
            variant="outline"
          >
            {Arr.map(stages, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.stages[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.light}
          label={labels.light}
          max={light.max}
          min={light.min}
          onValueChange={setLightVal}
          readout={`${Math.round(lightVal)}`}
          step={Math.max(1, (light.max - light.min) / 100)}
          value={lightVal}
        />
        <VisualSlider
          heading={labels.co2}
          label={labels.co2}
          max={co2.max}
          min={co2.min}
          onValueChange={setCo2Val}
          readout={`${Math.round(co2Val)}`}
          step={Math.max(1, (co2.max - co2.min) / 100)}
          value={co2Val}
        />
        <VisualSlider
          heading={labels.temperature}
          label={labels.temperature}
          max={temperature.max}
          min={temperature.min}
          onValueChange={setTempVal}
          readout={`${Math.round(tempVal)}`}
          step={Math.max(1, (temperature.max - temperature.min) / 100)}
          value={tempVal}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={2.3} setting="lab">
          <Suspense fallback={null}>
            <ChloroplastScene
              parts={labels.parts}
              reading={reading}
              stage={activeStage}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {siteCopy === undefined ? null : (
            <VisualFact label={labels.site} value={siteCopy} />
          )}
          {labels.limitingFactor === undefined ? null : (
            <VisualFact
              label={labels.limitingFactor}
              value={labels.factors[reading.limitingFactor]}
            />
          )}
          {labels.netGas === undefined ? null : (
            <VisualFactIndicator
              indicatorColor={gasIndicator}
              label={labels.netGas}
              value={labels.gasStates[reading.gasState]}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

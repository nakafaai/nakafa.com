import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type {
  ApertureState,
  StomataCondition,
  TurgorState,
} from "@repo/design-system/components/contents/biology/stomata/model";
import { evaluateStomata } from "@repo/design-system/components/contents/biology/stomata/model";
import { StomataScene } from "@repo/design-system/components/contents/biology/stomata/scene";
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
  VisualFactIndicator,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function StomatalGuardCellLab({
  conditions,
  description,
  labels,
  light,
  title,
}: {
  readonly conditions: readonly [StomataCondition, ...StomataCondition[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly aperture?: ReactNode;
    readonly apertures: Readonly<Record<ApertureState, string>>;
    readonly co2Intake: ReactNode;
    readonly condition: string;
    readonly conditions: Readonly<Partial<Record<StomataCondition, string>>>;
    readonly light: string;
    readonly mechanism?: ReactNode;
    readonly mechanisms: Readonly<Partial<Record<StomataCondition, ReactNode>>>;
    readonly parts: Readonly<
      Record<
        | "chloroplast"
        | "guardCell"
        | "pore"
        | "potassiumIon"
        | "thickInnerWall"
        | "thinOuterWall"
        | "vacuole"
        | "water",
        string
      >
    >;
    readonly transpiration: ReactNode;
    readonly turgor: ReactNode;
    readonly turgors: Readonly<Record<TurgorState, string>>;
    readonly view: string;
  };
  readonly light: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selectedCondition, setSelectedCondition] = useState<StomataCondition>(
    conditions[0]
  );
  const [lightLevel, setLightLevel] = useState(light.value);
  const quantity = useQuantity();

  const activeCondition = Arr.contains(conditions, selectedCondition)
    ? selectedCondition
    : conditions[0];
  const reading = evaluateStomata(
    activeCondition,
    lightLevel,
    light.min,
    light.max
  );
  const mechanismCopy = labels.mechanisms[activeCondition];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelectedCondition(conditions[0]);
          setLightLevel(light.value);
        }}
      />

      <VisualCardToolbar>
        {conditions.length > 1 ? (
          <ToggleGroup
            aria-label={labels.condition}
            gridColumns={toggleColumns(conditions.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(conditions, (item) => item === next),
                setSelectedCondition
              );
            }}
            type="single"
            value={activeCondition}
            variant="outline"
          >
            {Arr.map(conditions, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.conditions[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.light}
          label={labels.light}
          max={light.max}
          min={light.min}
          onValueChange={setLightLevel}
          readout={`${Math.round(lightLevel)}`}
          step={Math.max(1, (light.max - light.min) / 100)}
          value={lightLevel}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.2} setting="lab">
          <Suspense fallback={null}>
            <StomataScene parts={labels.parts} reading={reading} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            indicatorColor={
              reading.turgor === "turgid"
                ? FOLIAGE_COLORS.guardWallInner
                : FOLIAGE_COLORS.senescentLeaf
            }
            label={labels.turgor}
            value={labels.turgors[reading.turgor]}
          />
          <VisualFactTabular
            label={labels.co2Intake}
            value={<InlineMath math={quantity(reading.co2Percent, "\\%", 0)} />}
          />
          <VisualFactTabular
            label={labels.transpiration}
            value={
              <InlineMath
                math={quantity(reading.transpirationPercent, "\\%", 0)}
              />
            }
          />
          {labels.aperture === undefined ? null : (
            <VisualFact
              label={labels.aperture}
              value={labels.apertures[reading.aperture]}
            />
          )}
          {labels.mechanism === undefined ||
          mechanismCopy === undefined ? null : (
            <VisualFact label={labels.mechanism} value={mechanismCopy} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

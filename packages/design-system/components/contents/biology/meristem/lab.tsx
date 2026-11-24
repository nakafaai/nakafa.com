import type {
  GrowthMode,
  GrowthZone,
  PlantOrgan,
} from "@repo/design-system/components/contents/biology/meristem/model";
import {
  evaluatePrimaryZone,
  evaluateSecondaryGrowth,
} from "@repo/design-system/components/contents/biology/meristem/model";
import { MeristemGrowthScene } from "@repo/design-system/components/contents/biology/meristem/scene";
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
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function RootShootGrowthZoneLab({
  description,
  labels,
  modes,
  organs,
  title,
  years,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly activity?: ReactNode;
    readonly mode: string;
    readonly modes: Readonly<Partial<Record<GrowthMode, string>>>;
    readonly organ: string;
    readonly organs: Readonly<Partial<Record<PlantOrgan, string>>>;
    readonly parts: Readonly<
      Record<
        | "annualRing"
        | "apicalMeristem"
        | "corkCambium"
        | "rootCap"
        | "rootHair"
        | "secondaryPhloem"
        | "secondaryXylem"
        | "vacuole"
        | "vascularCambium",
        string
      >
    >;
    readonly position: string;
    readonly rings?: ReactNode;
    readonly view: string;
    readonly year: string;
    readonly zone: ReactNode;
    readonly zones: Readonly<
      Record<
        GrowthZone,
        { readonly activity: ReactNode; readonly name: string }
      >
    >;
  };
  readonly modes: readonly [GrowthMode, ...GrowthMode[]];
  readonly organs: readonly [PlantOrgan, ...PlantOrgan[]];
  readonly title: NonNullable<ReactNode>;
  readonly years: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
}) {
  const [selectedMode, setSelectedMode] = useState<GrowthMode>(modes[0]);
  const [selectedOrgan, setSelectedOrgan] = useState<PlantOrgan>(organs[0]);
  const [position, setPosition] = useState(20);
  const [year, setYear] = useState(years.value);

  const activeMode = Arr.contains(modes, selectedMode)
    ? selectedMode
    : modes[0];
  const activeOrgan = Arr.contains(organs, selectedOrgan)
    ? selectedOrgan
    : organs[0];
  const primary = evaluatePrimaryZone(position);
  const secondary = evaluateSecondaryGrowth(year);
  const zoneCopy = labels.zones[primary.zone];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelectedMode(modes[0]);
          setSelectedOrgan(organs[0]);
          setPosition(20);
          setYear(years.value);
        }}
      />

      <VisualCardToolbar>
        {modes.length > 1 ? (
          <ToggleGroup
            aria-label={labels.mode}
            gridColumns={toggleColumns(modes.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(modes, (item) => item === next),
                setSelectedMode
              );
            }}
            type="single"
            value={activeMode}
            variant="outline"
          >
            {Arr.map(modes, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.modes[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        {activeMode === "primary" && organs.length > 1 ? (
          <ToggleGroup
            aria-label={labels.organ}
            gridColumns={toggleColumns(organs.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(organs, (item) => item === next),
                setSelectedOrgan
              );
            }}
            type="single"
            value={activeOrgan}
            variant="outline"
          >
            {Arr.map(organs, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.organs[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        {activeMode === "primary" ? (
          <VisualSlider
            heading={labels.position}
            label={labels.position}
            max={100}
            min={0}
            onValueChange={setPosition}
            readout={`${Math.round(position)}%`}
            step={1}
            value={position}
          />
        ) : (
          <VisualSlider
            heading={labels.year}
            label={labels.year}
            max={years.max}
            min={years.min}
            onValueChange={setYear}
            readout={`${secondary.ringCount}`}
            step={1}
            value={year}
          />
        )}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.3} setting="lab">
          <Suspense fallback={null}>
            <MeristemGrowthScene
              mode={activeMode}
              organ={activeOrgan}
              parts={labels.parts}
              position={position}
              years={year}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {activeMode === "primary" ? (
            <>
              <VisualFactIndicator
                indicatorColor={FOLIAGE_COLORS.scanRing}
                label={labels.zone}
                value={zoneCopy.name}
              />
              {labels.activity === undefined ? null : (
                <VisualFact label={labels.activity} value={zoneCopy.activity} />
              )}
            </>
          ) : (
            <>
              <VisualFactIndicator
                indicatorColor={FOLIAGE_COLORS.cambium}
                label={labels.zone}
                value={labels.modes.secondary ?? activeMode}
              />
              {labels.rings === undefined ? null : (
                <VisualFactTabular
                  label={labels.rings}
                  value={`${secondary.ringCount}`}
                />
              )}
              {labels.activity === undefined ? null : (
                <VisualFact
                  label={labels.activity}
                  value={labels.parts.vascularCambium}
                />
              )}
            </>
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

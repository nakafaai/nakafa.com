import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { SurfacePreset } from "@repo/design-system/components/contents/chemistry/collision/model";
import { evaluateCollision } from "@repo/design-system/components/contents/chemistry/collision/model";
import { CollisionVesselScene } from "@repo/design-system/components/contents/chemistry/collision/scene";
import { BoltzmannTrace } from "@repo/design-system/components/contents/chemistry/collision/trace";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function CollisionTheoryEnergyLab({
  concentration,
  description,
  labels,
  surfaces,
  temperature,
  title,
}: {
  readonly concentration: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly activationEnergy: ReactNode;
    readonly collisionFreq?: ReactNode;
    readonly concentration: string;
    readonly effectiveRate?: ReactNode;
    readonly parts: Readonly<
      Record<
        "activationLine" | "products" | "reactants" | "shadedArea" | "vessel",
        string
      >
    >;
    readonly surface: string;
    readonly surfaces: Readonly<Partial<Record<SurfacePreset, string>>>;
    readonly temperature: string;
    readonly view: string;
  };
  readonly surfaces: readonly [SurfacePreset, ...SurfacePreset[]];
  readonly temperature: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selectedSurface, setSelectedSurface] = useState<SurfacePreset>(
    surfaces[0]
  );
  const [tempK, setTempK] = useState(temperature.value);
  const [concM, setConcM] = useState(concentration.value);
  const quantity = useQuantity();

  const activeSurface = Arr.contains(surfaces, selectedSurface)
    ? selectedSurface
    : surfaces[0];
  const reading = evaluateCollision(tempK, concM, activeSurface);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelectedSurface(surfaces[0]);
          setTempK(temperature.value);
          setConcM(concentration.value);
        }}
      />

      <VisualCardToolbar>
        {surfaces.length > 1 ? (
          <ToggleGroup
            aria-label={labels.surface}
            gridColumns={toggleColumns(surfaces.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(surfaces, (item) => item === next),
                setSelectedSurface
              );
            }}
            type="single"
            value={activeSurface}
            variant="outline"
          >
            {Arr.map(surfaces, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.surfaces[id] ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.temperature}
          label={labels.temperature}
          max={temperature.max}
          min={temperature.min}
          onValueChange={setTempK}
          readout={<InlineMath math={quantity(tempK, "\\text{ K}", 0)} />}
          step={5}
          value={tempK}
        />
        <VisualSlider
          heading={labels.concentration}
          label={labels.concentration}
          max={concentration.max}
          min={concentration.min}
          onValueChange={setConcM}
          readout={<InlineMath math={quantity(concM, "\\text{ M}", 2)} />}
          step={0.1}
          value={concM}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.9} setting="lab">
          <Suspense fallback={null}>
            <CollisionVesselScene
              concentrationM={concM}
              parts={labels.parts}
              surface={activeSurface}
              temperatureK={tempK}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <BoltzmannTrace
          activationLabel={labels.parts.activationLine}
          shadedLabel={labels.parts.shadedArea}
          temperatureK={tempK}
        />
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.activationEnergy}
            value={
              <InlineMath
                math={quantity(reading.effectiveFraction * 100, "\\%", 0)}
              />
            }
          />
          {labels.collisionFreq === undefined ? null : (
            <VisualFactTabular
              label={labels.collisionFreq}
              value={`${reading.collisionFrequency}`}
            />
          )}
          {labels.effectiveRate === undefined ? null : (
            <VisualFactTabular
              label={labels.effectiveRate}
              value={`${reading.effectiveRate}`}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

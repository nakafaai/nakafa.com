import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { RadiationModel } from "@repo/design-system/components/contents/physics/planck/model";
import { evaluateBlackbody } from "@repo/design-system/components/contents/physics/planck/model";
import { PlanckCavityScene } from "@repo/design-system/components/contents/physics/planck/scene";
import { BlackbodySpectrumTrace } from "@repo/design-system/components/contents/physics/planck/trace";
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

export function PlanckBlackbodyLab({
  description,
  labels,
  models,
  temperature,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly model: string;
    readonly models: Readonly<Partial<Record<RadiationModel, string>>>;
    readonly parts: Readonly<
      Record<
        | "cavity"
        | "classicalCurve"
        | "peakMarker"
        | "planckCurve"
        | "visibleBand",
        string
      >
    >;
    readonly peakWavelength?: ReactNode;
    readonly photonEnergy?: ReactNode;
    readonly spectrum: ReactNode;
    readonly temperature: string;
    readonly view: string;
  };
  readonly models: readonly [RadiationModel, ...RadiationModel[]];
  readonly temperature: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<RadiationModel>(models[0]);
  const [tempK, setTempK] = useState(temperature.value);
  const quantity = useQuantity();

  const active = Arr.contains(models, selected) ? selected : models[0];
  const reading = evaluateBlackbody(tempK);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(models[0]);
          setTempK(temperature.value);
        }}
      />

      <VisualCardToolbar>
        {models.length > 1 ? (
          <ToggleGroup
            aria-label={labels.model}
            gridColumns={toggleColumns(models.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(models, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(models, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.models[id] ?? id}
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
          step={100}
          value={tempK}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.2} setting="lab">
          <Suspense fallback={null}>
            <PlanckCavityScene
              model={active}
              parts={labels.parts}
              temperatureK={tempK}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <BlackbodySpectrumTrace
          classicalLabel={labels.parts.classicalCurve}
          model={active}
          planckLabel={labels.parts.planckCurve}
          temperatureK={tempK}
          visibleLabel={labels.parts.visibleBand}
        />
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.spectrum}
            value={labels.models[active] ?? active}
          />
          {labels.peakWavelength === undefined ? null : (
            <VisualFactTabular
              label={labels.peakWavelength}
              value={
                <InlineMath
                  math={quantity(reading.peakWavelengthNm, "\\text{ nm}", 0)}
                />
              }
            />
          )}
          {labels.photonEnergy === undefined ? null : (
            <VisualFactTabular
              label={labels.photonEnergy}
              value={
                <InlineMath
                  math={quantity(reading.peakPhotonEv, "\\text{ eV}", 2)}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

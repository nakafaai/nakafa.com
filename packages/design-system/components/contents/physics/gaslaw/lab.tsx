import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { GasLawId } from "@repo/design-system/components/contents/physics/gaslaw/model";
import { evaluateGasLaw } from "@repo/design-system/components/contents/physics/gaslaw/model";
import { GasLawScene } from "@repo/design-system/components/contents/physics/gaslaw/scene";
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
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function GasLawThermalLab({
  description,
  labels,
  laws,
  temperature,
  title,
  volume,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly collisions?: ReactNode;
    readonly constant: ReactNode;
    readonly law: string;
    readonly laws: Readonly<
      Partial<
        Record<
          GasLawId,
          { readonly name: string; readonly relation: ReactNode }
        >
      >
    >;
    readonly parts: Readonly<
      Record<"cylinder" | "gauge" | "heater" | "molecules" | "piston", string>
    >;
    readonly pressure?: ReactNode;
    readonly temperature: string;
    readonly view: string;
    readonly volume: string;
  };
  readonly laws: readonly [GasLawId, ...GasLawId[]];
  readonly temperature: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
  readonly volume: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
}) {
  const [selected, setSelected] = useState<GasLawId>(laws[0]);
  const [tempK, setTempK] = useState(temperature.value);
  const [volL, setVolL] = useState(volume.value);
  const quantity = useQuantity();

  const active = Arr.contains(laws, selected) ? selected : laws[0];
  const reading = evaluateGasLaw(active, tempK, volL);
  const lawCopy = labels.laws[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(laws[0]);
          setTempK(temperature.value);
          setVolL(volume.value);
        }}
      />

      <VisualCardToolbar>
        {laws.length > 1 ? (
          <ToggleGroup
            aria-label={labels.law}
            gridColumns={toggleColumns(laws.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(laws, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(laws, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.laws[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        {active === "boyle" ? null : (
          <VisualSlider
            heading={labels.temperature}
            label={labels.temperature}
            max={temperature.max}
            min={temperature.min}
            onValueChange={setTempK}
            readout={<InlineMath math={quantity(tempK, "\\text{ K}", 0)} />}
            step={10}
            value={tempK}
          />
        )}

        {active === "boyle" ? (
          <VisualSlider
            heading={labels.volume}
            label={labels.volume}
            max={volume.max}
            min={volume.min}
            onValueChange={setVolL}
            readout={<InlineMath math={quantity(volL, "\\text{ L}", 1)} />}
            step={0.5}
            value={volL}
          />
        ) : null}
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.3} setting="lab">
          <Suspense fallback={null}>
            <GasLawScene
              effectiveVolumeL={reading.effectiveVolumeL}
              parts={labels.parts}
              pressureKpa={reading.pressureKpa}
              temperatureK={active === "boyle" ? 300 : tempK}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {lawCopy === undefined ? null : (
            <VisualFact label={labels.constant} value={lawCopy.relation} />
          )}
          {labels.pressure === undefined ? null : (
            <VisualFactTabular
              label={labels.pressure}
              value={
                <InlineMath
                  math={quantity(reading.pressureKpa, "\\text{ kPa}", 1)}
                />
              }
            />
          )}
          {labels.collisions === undefined ? null : (
            <VisualFactTabular
              label={labels.collisions}
              value={`${reading.collisionIndex}%`}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

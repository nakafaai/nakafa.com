import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { BreathingPhase } from "@repo/design-system/components/contents/biology/thorax/model";
import { evaluateThoraxMechanics } from "@repo/design-system/components/contents/biology/thorax/model";
import { ThoraxDiaphragmScene } from "@repo/design-system/components/contents/biology/thorax/scene";
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

export function ThoraxDiaphragmLab({
  depth,
  description,
  labels,
  phases,
  title,
}: {
  readonly depth: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly alveolarPressure?: ReactNode;
    readonly depth: string;
    readonly parts: Readonly<
      Record<
        | "diaphragm"
        | "intercostal"
        | "lungs"
        | "pleuralCavity"
        | "ribcage"
        | "trachea",
        string
      >
    >;
    readonly phase: string;
    readonly phases: Readonly<
      Partial<
        Record<
          BreathingPhase,
          { readonly name: ReactNode; readonly summary: ReactNode }
        >
      >
    >;
    readonly thoracicVolume?: ReactNode;
    readonly view: string;
  };
  readonly phases: readonly [BreathingPhase, ...BreathingPhase[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<BreathingPhase>(phases[0]);
  const [breathDepth, setBreathDepth] = useState(depth.value);
  const quantity = useQuantity();

  const active = Arr.contains(phases, selected) ? selected : phases[0];
  const reading = evaluateThoraxMechanics(active, breathDepth);
  const copy = labels.phases[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setSelected(phases[0]);
          setBreathDepth(depth.value);
        }}
      />

      <VisualCardToolbar>
        {phases.length > 1 ? (
          <ToggleGroup
            aria-label={labels.phase}
            gridColumns={toggleColumns(phases.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(phases, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(phases, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.phases[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        <VisualSlider
          heading={labels.depth}
          label={labels.depth}
          max={depth.max}
          min={depth.min}
          onValueChange={setBreathDepth}
          readout={<InlineMath math={quantity(breathDepth, "\\%", 0)} />}
          step={1}
          value={breathDepth}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={2.8} setting="studio">
          <Suspense fallback={null}>
            <ThoraxDiaphragmScene
              depth={breathDepth}
              parts={labels.parts}
              phase={active}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {copy === undefined ? null : (
            <VisualFact label={labels.phase} value={copy.summary} />
          )}
          {labels.thoracicVolume === undefined ? null : (
            <VisualFactTabular
              label={labels.thoracicVolume}
              value={
                <InlineMath
                  math={quantity(reading.volumeLiters, "\\text{ L}", 2)}
                />
              }
            />
          )}
          {labels.alveolarPressure === undefined ? null : (
            <VisualFactTabular
              label={labels.alveolarPressure}
              value={
                <InlineMath
                  math={quantity(
                    reading.alveolarPressureDeltaMmHg,
                    "\\text{ mmHg}",
                    1
                  )}
                />
              }
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

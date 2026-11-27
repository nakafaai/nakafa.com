import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { BoxSheet } from "@repo/design-system/components/contents/mathematics/optimize/model";
import {
  BOX_SHEETS,
  evaluateOptimizationBox,
} from "@repo/design-system/components/contents/mathematics/optimize/model";
import {
  OPTIMIZE_SCALE,
  OptimizationBox3DScene,
} from "@repo/design-system/components/contents/mathematics/optimize/scene";
import { VolumeTrace } from "@repo/design-system/components/contents/mathematics/optimize/trace";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinates";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import {
  VisualFact,
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

/** The step of the cutout slider, which the play action sweeps by. */
const CUTOUT_STEP = 0.05;

export function OptimizationBox3DLab({
  cutout,
  description,
  labels,
  sheets,
  title,
}: {
  readonly cutout: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly boxVolume?: ReactNode;
    readonly cutout: string;
    readonly derivativeNote?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "basePlate"
        | "cornerCutouts"
        | "optimalMarker"
        | "sideFlaps"
        | "volumeCurve",
        string
      >
    >;
    readonly sheet: string;
    readonly sheets: Readonly<
      Partial<
        Record<
          BoxSheet,
          { readonly dimensions: ReactNode; readonly name: ReactNode }
        >
      >
    >;
    readonly view: string;
  };
  readonly sheets: readonly [BoxSheet, ...BoxSheet[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<BoxSheet>(sheets[0]);
  const [cutVal, setCutVal] = useState(cutout.value);
  const quantity = useQuantity();

  const active = Arr.contains(sheets, selected) ? selected : sheets[0];
  const reading = evaluateOptimizationBox(active, cutVal);
  const copy = labels.sheets[active];
  // How far the sheet reaches along X in the scene, which the view widens with.
  const reach = (BOX_SHEETS[active].length / 2) * OPTIMIZE_SCALE.x;

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <ViewReset
          onReset={() => {
            setSelected(sheets[0]);
            setCutVal(cutout.value);
          }}
        />

        <VisualCardToolbar>
          {sheets.length > 1 ? (
            <ToggleGroup
              aria-label={labels.sheet}
              gridColumns={toggleColumns(sheets.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(sheets, (item) => item === next),
                  setSelected
                );
              }}
              type="single"
              value={active}
              variant="outline"
            >
              {Arr.map(sheets, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.sheets[id]?.name ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          <VisualSlider
            heading={labels.cutout}
            label={labels.cutout}
            max={cutout.max}
            min={cutout.min}
            onValueChange={setCutVal}
            readout={<InlineMath math={quantity(cutVal, "", 2)} />}
            step={CUTOUT_STEP}
            value={cutVal}
          />
        </VisualCardToolbar>

        <CoordinateSystem
          aria-label={labels.view}
          cameraFraming="focus"
          cameraPosition={[3.6, 4.4, 6.2]}
          cameraTarget={[0.2, 0.2, 0]}
          focus={{
            x: { max: reach + 1, min: -reach - 1 },
            y: { max: 1.3, min: -0.1 },
            z: { max: 1.6, min: -1.4 },
          }}
          scale={OPTIMIZE_SCALE}
          showZAxis
          ticks
        >
          <Suspense fallback={null}>
            <OptimizationBox3DScene
              cutout={cutVal}
              parts={labels.parts}
              sheet={active}
              sweep={{
                initial: cutout.value,
                max: cutout.max,
                min: cutout.min,
                onValue: setCutVal,
                step: CUTOUT_STEP,
              }}
            />
          </Suspense>
        </CoordinateSystem>

        <CoordinateControls />

        <VisualCardFooter>
          <VolumeTrace
            curveLabel={labels.parts.volumeCurve}
            cutLabel={labels.cutout}
            cutout={cutVal}
            optimalLabel={labels.parts.optimalMarker}
            sheet={active}
          />
          <VisualCardFacts>
            {copy === undefined ? null : (
              <VisualFact label={labels.sheet} value={copy.dimensions} />
            )}
            {labels.boxVolume === undefined ? null : (
              <VisualFactTabular
                label={labels.boxVolume}
                value={<InlineMath math={quantity(reading.volume, "", 2)} />}
              />
            )}
            {labels.derivativeNote === undefined ? null : (
              <VisualFactTabular
                label={labels.derivativeNote}
                value={
                  <InlineMath
                    math={`V'(x) = ${quantity(reading.derivative, "", 2)}`}
                  />
                }
              />
            )}
          </VisualCardFacts>
        </VisualCardFooter>
      </VisualCard>
    </CoordinateProvider>
  );
}

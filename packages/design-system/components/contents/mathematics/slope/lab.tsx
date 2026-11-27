import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { SlopeCurve } from "@repo/design-system/components/contents/mathematics/slope/model";
import { evaluateSlopeField } from "@repo/design-system/components/contents/mathematics/slope/model";
import { DerivativeSlopeFieldScene } from "@repo/design-system/components/contents/mathematics/slope/scene";
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

export function DerivativeSlopeFieldLab({
  curves,
  description,
  labels,
  probeX,
  title,
}: {
  readonly curves: readonly [SlopeCurve, ...SlopeCurve[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly curve: string;
    readonly curves: Readonly<
      Partial<
        Record<
          SlopeCurve,
          { readonly formula: ReactNode; readonly name: ReactNode }
        >
      >
    >;
    readonly monotonicity?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "criticalPoints"
        | "derivativeCurve"
        | "functionCurve"
        | "probeMarker"
        | "slopeNeedles",
        string
      >
    >;
    readonly probeX: string;
    readonly slopeValue?: ReactNode;
    readonly view: string;
  };
  readonly probeX: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<SlopeCurve>(curves[0]);
  const [xVal, setXVal] = useState(probeX.value);
  const quantity = useQuantity();

  const active = Arr.contains(curves, selected) ? selected : curves[0];
  const reading = evaluateSlopeField(active, xVal);
  const copy = labels.curves[active];
  let signRelation = "< 0";
  if (reading.direction === "stationary") {
    signRelation = "= 0";
  } else if (reading.direction === "increasing") {
    signRelation = "> 0";
  }

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <ViewReset
          onReset={() => {
            setSelected(curves[0]);
            setXVal(probeX.value);
          }}
        />

        <VisualCardToolbar>
          {curves.length > 1 ? (
            <ToggleGroup
              aria-label={labels.curve}
              gridColumns={toggleColumns(curves.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(curves, (item) => item === next),
                  setSelected
                );
              }}
              type="single"
              value={active}
              variant="outline"
            >
              {Arr.map(curves, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.curves[id]?.name ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          <VisualSlider
            heading={labels.probeX}
            label={labels.probeX}
            max={probeX.max}
            min={probeX.min}
            onValueChange={setXVal}
            readout={<InlineMath math={quantity(xVal, "", 2)} />}
            step={0.05}
            value={xVal}
          />
        </VisualCardToolbar>

        <CoordinateSystem
          aria-label={labels.view}
          cameraPosition={[1.6, 2.2, 6.8]}
          cameraTarget={[0, 0.7, 0]}
          focus={{
            x: { max: 2.6, min: -2.6 },
            y: { max: 2.4, min: -1.4 },
            z: { max: 1.0, min: -1.0 },
          }}
          showZAxis
          ticks
        >
          <Suspense fallback={null}>
            <DerivativeSlopeFieldScene
              curve={active}
              parts={labels.parts}
              probeX={xVal}
            />
          </Suspense>
        </CoordinateSystem>

        <CoordinateControls />

        <VisualCardFooter>
          <VisualCardFacts>
            {copy === undefined ? null : (
              <VisualFact label={labels.curve} value={copy.formula} />
            )}
            {labels.slopeValue === undefined ? null : (
              <VisualFactTabular
                label={labels.slopeValue}
                value={
                  <InlineMath math={quantity(reading.derivative, "", 2)} />
                }
              />
            )}
            {labels.monotonicity === undefined ? null : (
              <VisualFact
                label={labels.monotonicity}
                value={
                  <InlineMath
                    math={`f'(${quantity(xVal, "", 2)}) ${signRelation}`}
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

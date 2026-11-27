import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { SecantCurve } from "@repo/design-system/components/contents/mathematics/secant/model";
import { evaluateSecantLimit } from "@repo/design-system/components/contents/mathematics/secant/model";
import { SecantToTangentScene } from "@repo/design-system/components/contents/mathematics/secant/scene";
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

export function SecantToTangentLab({
  curves,
  description,
  labels,
  stepH,
  title,
}: {
  readonly curves: readonly [SecantCurve, ...SecantCurve[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly curve: string;
    readonly curves: Readonly<
      Partial<
        Record<
          SecantCurve,
          { readonly formula: ReactNode; readonly name: ReactNode }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        | "anchorPoint"
        | "curveRibbon"
        | "movingPoint"
        | "secantLine"
        | "slopeTriangle"
        | "tangentLine",
        string
      >
    >;
    readonly secantSlope?: ReactNode;
    readonly stepH: string;
    readonly tangentSlope?: ReactNode;
    readonly view: string;
  };
  readonly stepH: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<SecantCurve>(curves[0]);
  const [hVal, setHVal] = useState(stepH.value);
  const quantity = useQuantity();

  const active = Arr.contains(curves, selected) ? selected : curves[0];
  const reading = evaluateSecantLimit(active, hVal);
  const copy = labels.curves[active];

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <ViewReset
          onReset={() => {
            setSelected(curves[0]);
            setHVal(stepH.value);
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
            heading={labels.stepH}
            label={labels.stepH}
            max={stepH.max}
            min={stepH.min}
            onValueChange={setHVal}
            readout={<InlineMath math={quantity(hVal, "", 2)} />}
            step={0.02}
            value={hVal}
          />
        </VisualCardToolbar>

        <CoordinateSystem
          aria-label={labels.view}
          cameraPosition={[0.8, 1.4, 7.2]}
          cameraTarget={[0.8, 1.1, 0]}
          focus={{
            x: { max: 3.4, min: -1.6 },
            y: { max: 3.2, min: -0.6 },
            z: { max: 0.4, min: -0.4 },
          }}
          showZAxis={false}
          ticks
        >
          <Suspense fallback={null}>
            <SecantToTangentScene
              curve={active}
              parts={labels.parts}
              stepH={hVal}
            />
          </Suspense>
        </CoordinateSystem>

        <CoordinateControls />

        <VisualCardFooter>
          <VisualCardFacts>
            {copy === undefined ? null : (
              <VisualFact label={labels.curve} value={copy.formula} />
            )}
            {labels.secantSlope === undefined ? null : (
              <VisualFactTabular
                label={labels.secantSlope}
                value={
                  <InlineMath math={quantity(reading.secantSlope, "", 3)} />
                }
              />
            )}
            {labels.tangentSlope === undefined ? null : (
              <VisualFactTabular
                label={labels.tangentSlope}
                value={
                  <InlineMath math={quantity(reading.tangentSlope, "", 3)} />
                }
              />
            )}
          </VisualCardFacts>
        </VisualCardFooter>
      </VisualCard>
    </CoordinateProvider>
  );
}

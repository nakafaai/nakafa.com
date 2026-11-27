import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { CurvePair } from "@repo/design-system/components/contents/mathematics/enclose/model";
import { evaluateAreaBetweenCurves } from "@repo/design-system/components/contents/mathematics/enclose/model";
import {
  AreaBetweenCurvesScene,
  ENCLOSE_SCALE,
} from "@repo/design-system/components/contents/mathematics/enclose/scene";
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

/** The step of the bound slider, which the play action sweeps by. */
const BOUND_STEP = 0.05;

export function AreaBetweenCurvesLab({
  description,
  labels,
  pairs,
  title,
  upperBound,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly enclosedArea?: ReactNode;
    readonly heightGap?: ReactNode;
    readonly pair: string;
    readonly pairs: Readonly<
      Partial<
        Record<
          CurvePair,
          { readonly formula: ReactNode; readonly name: ReactNode }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        | "intersectionPins"
        | "lowerCurve"
        | "shadedRibbon"
        | "upperCurve"
        | "verticalStrip",
        string
      >
    >;
    readonly upperBound: string;
    readonly view: string;
  };
  readonly pairs: readonly [CurvePair, ...CurvePair[]];
  readonly title: NonNullable<ReactNode>;
  readonly upperBound: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
}) {
  const [selected, setSelected] = useState<CurvePair>(pairs[0]);
  const [bound, setBound] = useState(upperBound.value);
  const quantity = useQuantity();

  const active = Arr.contains(pairs, selected) ? selected : pairs[0];
  const reading = evaluateAreaBetweenCurves(active, bound);
  const copy = labels.pairs[active];

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <ViewReset
          onReset={() => {
            setSelected(pairs[0]);
            setBound(upperBound.value);
          }}
        />

        <VisualCardToolbar>
          {pairs.length > 1 ? (
            <ToggleGroup
              aria-label={labels.pair}
              gridColumns={toggleColumns(pairs.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(pairs, (item) => item === next),
                  setSelected
                );
              }}
              type="single"
              value={active}
              variant="outline"
            >
              {Arr.map(pairs, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.pairs[id]?.name ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          <VisualSlider
            heading={labels.upperBound}
            label={labels.upperBound}
            max={upperBound.max}
            min={upperBound.min}
            onValueChange={setBound}
            readout={<InlineMath math={quantity(bound, "", 2)} />}
            step={BOUND_STEP}
            value={bound}
          />
        </VisualCardToolbar>

        <CoordinateSystem
          aria-label={labels.view}
          cameraFraming="focus"
          cameraPosition={[2.4, 0.9, 10]}
          cameraProjection={{ kind: "orthographic" }}
          cameraTarget={[2.4, 0.9, 0]}
          focus={{
            x: { max: 6, min: -1.2 },
            y: { max: 2.6, min: -0.8 },
            z: { max: 0.4, min: -0.4 },
          }}
          playOrbit={false}
          scale={ENCLOSE_SCALE}
          showZAxis={false}
          ticks
        >
          <Suspense fallback={null}>
            <AreaBetweenCurvesScene
              pair={active}
              parts={labels.parts}
              sweep={{
                initial: upperBound.value,
                max: upperBound.max,
                min: upperBound.min,
                onValue: setBound,
                step: BOUND_STEP,
              }}
              upperBound={bound}
            />
          </Suspense>
        </CoordinateSystem>

        <CoordinateControls />

        <VisualCardFooter>
          <VisualCardFacts>
            {copy === undefined ? null : (
              <VisualFact label={labels.pair} value={copy.formula} />
            )}
            {labels.enclosedArea === undefined ? null : (
              <VisualFactTabular
                label={labels.enclosedArea}
                value={
                  <InlineMath math={quantity(reading.enclosedArea, "", 3)} />
                }
              />
            )}
            {labels.heightGap === undefined ? null : (
              <VisualFactTabular
                label={labels.heightGap}
                value={
                  <InlineMath math={quantity(reading.gapAtBound, "", 3)} />
                }
              />
            )}
          </VisualCardFacts>
        </VisualCardFooter>
      </VisualCard>
    </CoordinateProvider>
  );
}

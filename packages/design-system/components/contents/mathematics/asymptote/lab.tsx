import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { AsymptoteCurve } from "@repo/design-system/components/contents/mathematics/asymptote/model";
import { evaluateAsymptoteProbe } from "@repo/design-system/components/contents/mathematics/asymptote/model";
import { AsymptoteBehaviorScene } from "@repo/design-system/components/contents/mathematics/asymptote/scene";
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

export function AsymptoteBehaviorLab({
  curves,
  description,
  labels,
  probeX,
  title,
}: {
  readonly curves: readonly [AsymptoteCurve, ...AsymptoteCurve[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly approachValue?: ReactNode;
    readonly asymptoteSummary?: ReactNode;
    readonly curve: string;
    readonly curves: Readonly<
      Partial<
        Record<
          AsymptoteCurve,
          { readonly formula: ReactNode; readonly name: string }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        | "curveBranches"
        | "horizontalAsymptote"
        | "leftProbe"
        | "rightProbe"
        | "verticalAsymptote",
        string
      >
    >;
    readonly probeX: string;
    readonly view: string;
  };
  readonly probeX: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<AsymptoteCurve>(curves[0]);
  const [xVal, setXVal] = useState(probeX.value);
  const quantity = useQuantity();

  const active = Arr.contains(curves, selected) ? selected : curves[0];
  const reading = evaluateAsymptoteProbe(active, xVal);
  const copy = labels.curves[active];

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
          cameraPosition={[0, 0.2, 7.6]}
          cameraTarget={[0, 0, 0]}
          focus={{
            x: { max: 3.0, min: -3.0 },
            y: { max: 2.8, min: -2.8 },
            z: { max: 0.4, min: -0.4 },
          }}
          showZAxis={false}
          ticks
        >
          <Suspense fallback={null}>
            <AsymptoteBehaviorScene
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
            {labels.asymptoteSummary === undefined ? null : (
              <VisualFactTabular
                label={labels.asymptoteSummary}
                value={
                  <InlineMath
                    math={`x = ${quantity(reading.verticalX, "", 1)},\\ y \\to ${quantity(reading.horizontalY, "", 2)}`}
                  />
                }
              />
            )}
            {labels.approachValue === undefined ? null : (
              <VisualFactTabular
                label={labels.approachValue}
                value={<InlineMath math={quantity(reading.valueY, "", 2)} />}
              />
            )}
          </VisualCardFacts>
        </VisualCardFooter>
      </VisualCard>
    </CoordinateProvider>
  );
}

import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type {
  RiemannCurve,
  RiemannMethod,
} from "@repo/design-system/components/contents/mathematics/riemann/model";
import { evaluateRiemannSum } from "@repo/design-system/components/contents/mathematics/riemann/model";
import { RiemannSumConvergenceScene } from "@repo/design-system/components/contents/mathematics/riemann/scene";
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

export function RiemannSumConvergenceLab({
  curves,
  description,
  labels,
  methods,
  partitions,
  title,
}: {
  readonly curves: readonly [RiemannCurve, ...RiemannCurve[]];
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly approxArea?: ReactNode;
    readonly curve: string;
    readonly curves: Readonly<
      Partial<
        Record<
          RiemannCurve,
          { readonly formula: ReactNode; readonly name: ReactNode }
        >
      >
    >;
    readonly exactIntegral?: ReactNode;
    readonly method: string;
    readonly methods: Readonly<Partial<Record<RiemannMethod, string>>>;
    readonly partitions: string;
    readonly parts: Readonly<
      Record<
        | "baseAxis"
        | "curveSurface"
        | "exactArea"
        | "riemannPrisms"
        | "samplePoints",
        string
      >
    >;
    readonly view: string;
  };
  readonly methods: readonly [RiemannMethod, ...RiemannMethod[]];
  readonly partitions: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selectedCurve, setSelectedCurve] = useState<RiemannCurve>(curves[0]);
  const [selectedMethod, setSelectedMethod] = useState<RiemannMethod>(
    methods[0]
  );
  const [nVal, setNVal] = useState(partitions.value);
  const quantity = useQuantity();

  const activeCurve = Arr.contains(curves, selectedCurve)
    ? selectedCurve
    : curves[0];
  const activeMethod = Arr.contains(methods, selectedMethod)
    ? selectedMethod
    : methods[0];
  const reading = evaluateRiemannSum(activeCurve, activeMethod, nVal);
  const copy = labels.curves[activeCurve];

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <ViewReset
          onReset={() => {
            setSelectedCurve(curves[0]);
            setSelectedMethod(methods[0]);
            setNVal(partitions.value);
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
                  setSelectedCurve
                );
              }}
              type="single"
              value={activeCurve}
              variant="outline"
            >
              {Arr.map(curves, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.curves[id]?.name ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          {methods.length > 1 ? (
            <ToggleGroup
              aria-label={labels.method}
              gridColumns={toggleColumns(methods.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(methods, (item) => item === next),
                  setSelectedMethod
                );
              }}
              type="single"
              value={activeMethod}
              variant="outline"
            >
              {Arr.map(methods, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.methods[id] ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          <VisualSlider
            heading={labels.partitions}
            label={labels.partitions}
            max={partitions.max}
            min={partitions.min}
            onValueChange={setNVal}
            readout={<InlineMath math={`n = ${Math.round(nVal)}`} />}
            step={1}
            value={nVal}
          />
        </VisualCardToolbar>

        <CoordinateSystem
          aria-label={labels.view}
          cameraPosition={[2.4, 2.3, 6.2]}
          cameraTarget={[2.0, 0.9, 0]}
          focus={{
            x: { max: 4.2, min: -0.2 },
            y: { max: 2.4, min: -0.2 },
            z: { max: 0.8, min: -0.8 },
          }}
          showZAxis
          ticks
        >
          <Suspense fallback={null}>
            <RiemannSumConvergenceScene
              curve={activeCurve}
              method={activeMethod}
              partitions={nVal}
              parts={labels.parts}
            />
          </Suspense>
        </CoordinateSystem>

        <CoordinateControls />

        <VisualCardFooter>
          <VisualCardFacts>
            {copy === undefined ? null : (
              <VisualFact label={labels.curve} value={copy.formula} />
            )}
            {labels.approxArea === undefined ? null : (
              <VisualFactTabular
                label={labels.approxArea}
                value={
                  <InlineMath math={quantity(reading.approxArea, "", 3)} />
                }
              />
            )}
            {labels.exactIntegral === undefined ? null : (
              <VisualFactTabular
                label={labels.exactIntegral}
                value={
                  <InlineMath math={quantity(reading.exactIntegral, "", 3)} />
                }
              />
            )}
          </VisualCardFacts>
        </VisualCardFooter>
      </VisualCard>
    </CoordinateProvider>
  );
}

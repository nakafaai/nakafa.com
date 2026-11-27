import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { EpsilonFunction } from "@repo/design-system/components/contents/mathematics/epsilon/model";
import { evaluateEpsilonDelta } from "@repo/design-system/components/contents/mathematics/epsilon/model";
import { EpsilonDeltaBandScene } from "@repo/design-system/components/contents/mathematics/epsilon/scene";
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

/** The step of the tolerance slider, which the play action sweeps by. */
const EPSILON_STEP = 0.02;

export function EpsilonDeltaBandLab({
  description,
  epsilon,
  functions,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly epsilon: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly functions: readonly [EpsilonFunction, ...EpsilonFunction[]];
  readonly labels: {
    readonly deltaBound?: ReactNode;
    readonly epsilon: string;
    readonly functionLabel: string;
    readonly functions: Readonly<
      Partial<
        Record<
          EpsilonFunction,
          { readonly formula: ReactNode; readonly name: ReactNode }
        >
      >
    >;
    readonly limitVerdict?: ReactNode;
    readonly parts: Readonly<
      Record<
        "curvePath" | "deltaBand" | "epsilonBand" | "holePoint" | "limitTarget",
        string
      >
    >;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<EpsilonFunction>(functions[0]);
  const [epsVal, setEpsVal] = useState(epsilon.value);
  const quantity = useQuantity();

  const active = Arr.contains(functions, selected) ? selected : functions[0];
  const reading = evaluateEpsilonDelta(active, epsVal);
  const copy = labels.functions[active];

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <ViewReset
          onReset={() => {
            setSelected(functions[0]);
            setEpsVal(epsilon.value);
          }}
        />

        <VisualCardToolbar>
          {functions.length > 1 ? (
            <ToggleGroup
              aria-label={labels.functionLabel}
              gridColumns={toggleColumns(functions.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(functions, (item) => item === next),
                  setSelected
                );
              }}
              type="single"
              value={active}
              variant="outline"
            >
              {Arr.map(functions, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.functions[id]?.name ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          <VisualSlider
            heading={labels.epsilon}
            label={labels.epsilon}
            max={epsilon.max}
            min={epsilon.min}
            onValueChange={setEpsVal}
            readout={
              <InlineMath math={`\\varepsilon = ${quantity(epsVal, "", 2)}`} />
            }
            step={EPSILON_STEP}
            value={epsVal}
          />
        </VisualCardToolbar>

        <CoordinateSystem
          aria-label={labels.view}
          cameraFraming="focus"
          cameraPosition={[0.3, 1, 10]}
          cameraProjection={{ kind: "orthographic" }}
          cameraTarget={[0.3, 1, 0]}
          focus={{
            x: { max: 3.2, min: -2.6 },
            y: { max: 3, min: -1 },
            z: { max: 0.4, min: -0.4 },
          }}
          playOrbit={false}
          showZAxis={false}
          ticks
        >
          <Suspense fallback={null}>
            <EpsilonDeltaBandScene
              epsilon={epsVal}
              fn={active}
              parts={labels.parts}
              sweep={{
                initial: epsilon.value,
                max: epsilon.max,
                min: epsilon.min,
                onValue: setEpsVal,
                step: EPSILON_STEP,
              }}
            />
          </Suspense>
        </CoordinateSystem>

        <CoordinateControls />

        <VisualCardFooter>
          <VisualCardFacts>
            {copy === undefined ? null : (
              <VisualFact label={labels.functionLabel} value={copy.formula} />
            )}
            {labels.deltaBound === undefined ? null : (
              <VisualFactTabular
                label={labels.deltaBound}
                value={
                  <InlineMath
                    math={`\\delta = ${quantity(reading.delta, "", 3)}`}
                  />
                }
              />
            )}
            {labels.limitVerdict === undefined ? null : (
              <VisualFactTabular
                label={labels.limitVerdict}
                value={
                  <InlineMath
                    math={`|f(x) - L| < ${quantity(epsVal, "", 2)}`}
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

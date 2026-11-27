import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { EigenTransform } from "@repo/design-system/components/contents/mathematics/eigen/model";
import { evaluateEigenTransform } from "@repo/design-system/components/contents/mathematics/eigen/model";
import { EigenTransform3DScene } from "@repo/design-system/components/contents/mathematics/eigen/scene";
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

/** The step of the progress slider, which the play action sweeps by. */
const PROGRESS_STEP = 0.02;

export function EigenTransform3DLab({
  description,
  labels,
  progress,
  title,
  transforms,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly determinant?: ReactNode;
    readonly eigenvalues?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "basisAxes"
        | "eigenvectorOne"
        | "eigenvectorThree"
        | "eigenvectorTwo"
        | "testVector"
        | "transformedGrid",
        string
      >
    >;
    readonly progress: string;
    readonly transform: string;
    readonly transforms: Readonly<
      Partial<
        Record<
          EigenTransform,
          { readonly formula: ReactNode; readonly name: ReactNode }
        >
      >
    >;
    readonly view: string;
  };
  readonly progress: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
  readonly transforms: readonly [EigenTransform, ...EigenTransform[]];
}) {
  const [selected, setSelected] = useState<EigenTransform>(transforms[0]);
  const [tVal, setTVal] = useState(progress.value);
  const quantity = useQuantity();

  const active = Arr.contains(transforms, selected) ? selected : transforms[0];
  const reading = evaluateEigenTransform(active, tVal);
  const copy = labels.transforms[active];

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <ViewReset
          onReset={() => {
            setSelected(transforms[0]);
            setTVal(progress.value);
          }}
        />

        <VisualCardToolbar>
          {transforms.length > 1 ? (
            <ToggleGroup
              aria-label={labels.transform}
              gridColumns={toggleColumns(transforms.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(transforms, (item) => item === next),
                  setSelected
                );
              }}
              type="single"
              value={active}
              variant="outline"
            >
              {Arr.map(transforms, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.transforms[id]?.name ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          <VisualSlider
            heading={labels.progress}
            label={labels.progress}
            max={progress.max}
            min={progress.min}
            onValueChange={setTVal}
            readout={<InlineMath math={quantity(tVal, "", 2)} />}
            step={PROGRESS_STEP}
            value={tVal}
          />
        </VisualCardToolbar>

        <CoordinateSystem
          aria-label={labels.view}
          cameraFraming="focus"
          cameraPosition={[4.4, 3.2, 6.2]}
          cameraTarget={[0.5, 0.5, 0.4]}
          focus={{
            x: { max: 2.6, min: -1.4 },
            y: { max: 1.8, min: -0.4 },
            z: { max: 1.6, min: -0.2 },
          }}
          showZAxis
          ticks
        >
          <Suspense fallback={null}>
            <EigenTransform3DScene
              parts={labels.parts}
              progress={tVal}
              sweep={{
                initial: progress.value,
                max: progress.max,
                min: progress.min,
                onValue: setTVal,
                step: PROGRESS_STEP,
              }}
              transform={active}
            />
          </Suspense>
        </CoordinateSystem>

        <CoordinateControls />

        <VisualCardFooter>
          <VisualCardFacts>
            {copy === undefined ? null : (
              <VisualFact label={labels.transform} value={copy.formula} />
            )}
            {labels.eigenvalues === undefined ? null : (
              <VisualFactTabular
                label={labels.eigenvalues}
                value={
                  <InlineMath
                    math={`\\lambda = (${reading.eigenvalues[0]},\\ ${reading.eigenvalues[1]},\\ ${reading.eigenvalues[2]})`}
                  />
                }
              />
            )}
            {labels.determinant === undefined ? null : (
              <VisualFactTabular
                label={labels.determinant}
                value={
                  <InlineMath math={quantity(reading.determinant, "", 2)} />
                }
              />
            )}
          </VisualCardFacts>
        </VisualCardFooter>
      </VisualCard>
    </CoordinateProvider>
  );
}

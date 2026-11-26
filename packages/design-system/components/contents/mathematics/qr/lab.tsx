import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { QrStep } from "@repo/design-system/components/contents/mathematics/qr/model";
import { evaluateQrStep } from "@repo/design-system/components/contents/mathematics/qr/model";
import { QrGramSchmidt3DScene } from "@repo/design-system/components/contents/mathematics/qr/scene";
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

export function QrGramSchmidt3DLab({
  description,
  labels,
  skew,
  steps,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly orthogonalityCheck?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "inputVectors"
        | "orthogonalFrame"
        | "orthonormalBasis"
        | "projectionShadow"
        | "unitSphere",
        string
      >
    >;
    readonly rEntries?: ReactNode;
    readonly skew: string;
    readonly step: string;
    readonly steps: Readonly<
      Partial<
        Record<QrStep, { readonly name: string; readonly summary: ReactNode }>
      >
    >;
    readonly view: string;
  };
  readonly skew: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly steps: readonly [QrStep, ...QrStep[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<QrStep>(steps[0]);
  const [skewVal, setSkewVal] = useState(skew.value);
  const quantity = useQuantity();

  const active = Arr.contains(steps, selected) ? selected : steps[0];
  const reading = evaluateQrStep(active, skewVal);
  const copy = labels.steps[active];

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <ViewReset
          onReset={() => {
            setSelected(steps[0]);
            setSkewVal(skew.value);
          }}
        />

        <VisualCardToolbar>
          {steps.length > 1 ? (
            <ToggleGroup
              aria-label={labels.step}
              gridColumns={toggleColumns(steps.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(steps, (item) => item === next),
                  setSelected
                );
              }}
              type="single"
              value={active}
              variant="outline"
            >
              {Arr.map(steps, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.steps[id]?.name ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          <VisualSlider
            heading={labels.skew}
            label={labels.skew}
            max={skew.max}
            min={skew.min}
            onValueChange={setSkewVal}
            readout={<InlineMath math={quantity(skewVal, "", 2)} />}
            step={0.02}
            value={skewVal}
          />
        </VisualCardToolbar>

        <CoordinateSystem
          aria-label={labels.view}
          cameraPosition={[4.6, 3.5, 5.2]}
          cameraTarget={[0.4, 0.5, 0.4]}
          focus={{
            x: { max: 2.6, min: -2.0 },
            y: { max: 2.2, min: -1.8 },
            z: { max: 2.2, min: -1.8 },
          }}
          showZAxis
          ticks
        >
          <Suspense fallback={null}>
            <QrGramSchmidt3DScene
              parts={labels.parts}
              skew={skewVal}
              step={active}
            />
          </Suspense>
        </CoordinateSystem>

        <CoordinateControls />

        <VisualCardFooter>
          <VisualCardFacts>
            {copy === undefined ? null : (
              <VisualFact label={labels.step} value={copy.summary} />
            )}
            {labels.orthogonalityCheck === undefined ? null : (
              <VisualFactTabular
                label={labels.orthogonalityCheck}
                value={
                  <InlineMath
                    math={`\\|Q^\\top Q - I\\| = ${quantity(reading.orthogonalityError, "", 2)}`}
                  />
                }
              />
            )}
            {labels.rEntries === undefined ? null : (
              <VisualFactTabular
                label={labels.rEntries}
                value={
                  <InlineMath
                    math={`R_{12} = ${quantity(reading.r12, "", 2)}`}
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

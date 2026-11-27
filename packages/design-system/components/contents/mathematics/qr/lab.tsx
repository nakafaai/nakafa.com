import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { QrStep } from "@repo/design-system/components/contents/mathematics/qr/model";
import { evaluateQrStep } from "@repo/design-system/components/contents/mathematics/qr/model";
import {
  QR_SCALE,
  QrGramSchmidt3DScene,
} from "@repo/design-system/components/contents/mathematics/qr/scene";
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

/** The step of the skew slider, which the play action sweeps by. */
const SKEW_STEP = 0.02;

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
        Record<
          QrStep,
          { readonly name: ReactNode; readonly summary: ReactNode }
        >
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
              gridColumns="2-sm"
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
            step={SKEW_STEP}
            value={skewVal}
          />
        </VisualCardToolbar>

        <CoordinateSystem
          aria-label={labels.view}
          cameraFraming="focus"
          cameraPosition={[4.2, 3, 6.4]}
          cameraTarget={[0.3, 0.2, 0.2]}
          focus={{
            x: { max: 2.2, min: -1.5 },
            y: { max: 1.6, min: -1.5 },
            z: { max: 1.5, min: -1.5 },
          }}
          scale={QR_SCALE}
          showZAxis
          ticks
        >
          <Suspense fallback={null}>
            <QrGramSchmidt3DScene
              parts={labels.parts}
              skew={skewVal}
              step={active}
              sweep={{
                initial: skew.value,
                max: skew.max,
                min: skew.min,
                onValue: setSkewVal,
                step: SKEW_STEP,
              }}
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

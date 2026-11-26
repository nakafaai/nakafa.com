import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { SqueezeEnvelope } from "@repo/design-system/components/contents/mathematics/squeeze/model";
import { evaluateSqueezeTheorem } from "@repo/design-system/components/contents/mathematics/squeeze/model";
import { SqueezeTheoremWaveScene } from "@repo/design-system/components/contents/mathematics/squeeze/scene";
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

export function SqueezeTheoremWaveLab({
  description,
  envelopes,
  labels,
  radius,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly envelopes: readonly [SqueezeEnvelope, ...SqueezeEnvelope[]];
  readonly labels: {
    readonly boundSpread?: ReactNode;
    readonly envelope: string;
    readonly envelopes: Readonly<
      Partial<
        Record<
          SqueezeEnvelope,
          { readonly formula: ReactNode; readonly name: string }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        | "lowerBound"
        | "pinchPoint"
        | "squeezedWave"
        | "upperBound"
        | "windowFrame",
        string
      >
    >;
    readonly radius: string;
    readonly squeezedLimit?: ReactNode;
    readonly view: string;
  };
  readonly radius: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<SqueezeEnvelope>(envelopes[0]);
  const [rVal, setRVal] = useState(radius.value);
  const quantity = useQuantity();

  const active = Arr.contains(envelopes, selected) ? selected : envelopes[0];
  const reading = evaluateSqueezeTheorem(active, rVal);
  const copy = labels.envelopes[active];

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <ViewReset
          onReset={() => {
            setSelected(envelopes[0]);
            setRVal(radius.value);
          }}
        />

        <VisualCardToolbar>
          {envelopes.length > 1 ? (
            <ToggleGroup
              aria-label={labels.envelope}
              gridColumns={toggleColumns(envelopes.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(envelopes, (item) => item === next),
                  setSelected
                );
              }}
              type="single"
              value={active}
              variant="outline"
            >
              {Arr.map(envelopes, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.envelopes[id]?.name ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          <VisualSlider
            heading={labels.radius}
            label={labels.radius}
            max={radius.max}
            min={radius.min}
            onValueChange={setRVal}
            readout={<InlineMath math={`r = ${quantity(rVal, "", 2)}`} />}
            step={0.02}
            value={rVal}
          />
        </VisualCardToolbar>

        <CoordinateSystem
          aria-label={labels.view}
          cameraPosition={[0, 0.2, 6.4]}
          cameraTarget={[0, 0.1, 0]}
          focus={{
            x: { max: 2.3, min: -2.3 },
            y: { max: 1.9, min: -1.8 },
            z: { max: 0.4, min: -0.4 },
          }}
          showZAxis={false}
          ticks
        >
          <Suspense fallback={null}>
            <SqueezeTheoremWaveScene
              envelope={active}
              parts={labels.parts}
              radius={rVal}
            />
          </Suspense>
        </CoordinateSystem>

        <CoordinateControls />

        <VisualCardFooter>
          <VisualCardFacts>
            {copy === undefined ? null : (
              <VisualFact label={labels.envelope} value={copy.formula} />
            )}
            {labels.boundSpread === undefined ? null : (
              <VisualFactTabular
                label={labels.boundSpread}
                value={
                  <InlineMath math={quantity(reading.boundSpread, "", 3)} />
                }
              />
            )}
            {labels.squeezedLimit === undefined ? null : (
              <VisualFactTabular
                label={labels.squeezedLimit}
                value={
                  <InlineMath
                    math={`\\lim = ${quantity(reading.limitValue, "", 0)}`}
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

import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { RevolutionProfile } from "@repo/design-system/components/contents/mathematics/revolution/model";
import { evaluateSolidRevolution } from "@repo/design-system/components/contents/mathematics/revolution/model";
import {
  REVOLUTION_SCALE,
  SolidOfRevolutionScene,
} from "@repo/design-system/components/contents/mathematics/revolution/scene";
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

/** The step of the sweep slider, which the play action sweeps by. */
const SWEEP_STEP = 5;

export function SolidOfRevolutionLab({
  description,
  labels,
  profiles,
  sweepAngle,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly parts: Readonly<
      Record<
        | "crossSectionDisk"
        | "profileCurve"
        | "radiusArrow"
        | "revolvedShell"
        | "rotationAxis",
        string
      >
    >;
    readonly profile: string;
    readonly profiles: Readonly<
      Partial<
        Record<
          RevolutionProfile,
          { readonly formula: ReactNode; readonly name: ReactNode }
        >
      >
    >;
    readonly sliceArea?: ReactNode;
    readonly sweepAngle: string;
    readonly totalVolume?: ReactNode;
    readonly view: string;
  };
  readonly profiles: readonly [RevolutionProfile, ...RevolutionProfile[]];
  readonly sweepAngle: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<RevolutionProfile>(profiles[0]);
  const [angle, setAngle] = useState(sweepAngle.value);
  const quantity = useQuantity();

  const active = Arr.contains(profiles, selected) ? selected : profiles[0];
  const reading = evaluateSolidRevolution(active, angle);
  const copy = labels.profiles[active];

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <ViewReset
          onReset={() => {
            setSelected(profiles[0]);
            setAngle(sweepAngle.value);
          }}
        />

        <VisualCardToolbar>
          {profiles.length > 1 ? (
            <ToggleGroup
              aria-label={labels.profile}
              gridColumns={toggleColumns(profiles.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(profiles, (item) => item === next),
                  setSelected
                );
              }}
              type="single"
              value={active}
              variant="outline"
            >
              {Arr.map(profiles, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.profiles[id]?.name ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          <VisualSlider
            heading={labels.sweepAngle}
            label={labels.sweepAngle}
            max={sweepAngle.max}
            min={sweepAngle.min}
            onValueChange={setAngle}
            readout={<InlineMath math={quantity(angle, "^\\circ", 0)} />}
            step={SWEEP_STEP}
            value={angle}
          />
        </VisualCardToolbar>

        <CoordinateSystem
          aria-label={labels.view}
          cameraFraming="focus"
          cameraPosition={[3.4, 2.6, 6.2]}
          cameraTarget={[0, 0, 0]}
          focus={{
            x: { max: 1.7, min: -1.7 },
            y: { max: 1.3, min: -1.3 },
            z: { max: 1.3, min: -1.3 },
          }}
          scale={REVOLUTION_SCALE}
          showZAxis
          ticks
        >
          <Suspense fallback={null}>
            <SolidOfRevolutionScene
              parts={labels.parts}
              profile={active}
              sweep={{
                initial: sweepAngle.value,
                max: sweepAngle.max,
                min: sweepAngle.min,
                onValue: setAngle,
                step: SWEEP_STEP,
              }}
              sweepAngle={angle}
            />
          </Suspense>
        </CoordinateSystem>

        <CoordinateControls />

        <VisualCardFooter>
          <VisualCardFacts>
            {copy === undefined ? null : (
              <VisualFact label={labels.profile} value={copy.formula} />
            )}
            {labels.sliceArea === undefined ? null : (
              <VisualFactTabular
                label={labels.sliceArea}
                value={<InlineMath math={quantity(reading.sliceArea, "", 2)} />}
              />
            )}
            {labels.totalVolume === undefined ? null : (
              <VisualFactTabular
                label={labels.totalVolume}
                value={
                  <InlineMath math={quantity(reading.sweptVolume, "", 2)} />
                }
              />
            )}
          </VisualCardFacts>
        </VisualCardFooter>
      </VisualCard>
    </CoordinateProvider>
  );
}

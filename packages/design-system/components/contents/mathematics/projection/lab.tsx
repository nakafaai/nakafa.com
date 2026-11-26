import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { DotPreset } from "@repo/design-system/components/contents/mathematics/projection/model";
import {
  evaluateDotProjection,
  presetDotAngle,
} from "@repo/design-system/components/contents/mathematics/projection/model";
import { DotProductProjection3DScene } from "@repo/design-system/components/contents/mathematics/projection/scene";
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

export function DotProductProjection3DLab({
  angle,
  description,
  labels,
  presets,
  title,
}: {
  readonly angle: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly angle: string;
    readonly dotValue?: ReactNode;
    readonly parts: Readonly<
      Record<
        | "angleArc"
        | "coordinateAxes"
        | "dropLine"
        | "projectionVector"
        | "vectorU"
        | "vectorV",
        string
      >
    >;
    readonly preset: string;
    readonly presets: Readonly<Partial<Record<DotPreset, string>>>;
    readonly projectionLength?: ReactNode;
    readonly view: string;
  };
  readonly presets: readonly [DotPreset, ...DotPreset[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<DotPreset>(presets[0]);
  const [deg, setDeg] = useState(angle.value);
  const quantity = useQuantity();

  const active = Arr.contains(presets, selected) ? selected : presets[0];
  const reading = evaluateDotProjection(deg);

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <ViewReset
          onReset={() => {
            setSelected(presets[0]);
            setDeg(angle.value);
          }}
        />

        <VisualCardToolbar>
          {presets.length > 1 ? (
            <ToggleGroup
              aria-label={labels.preset}
              gridColumns={toggleColumns(presets.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(presets, (item) => item === next),
                  (preset) => {
                    setSelected(preset);
                    setDeg(
                      Math.min(
                        angle.max,
                        Math.max(angle.min, presetDotAngle(preset))
                      )
                    );
                  }
                );
              }}
              type="single"
              value={active}
              variant="outline"
            >
              {Arr.map(presets, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.presets[id] ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          <VisualSlider
            heading={labels.angle}
            label={labels.angle}
            max={angle.max}
            min={angle.min}
            onValueChange={setDeg}
            readout={<InlineMath math={quantity(deg, "^\\circ", 0)} />}
            step={1}
            value={deg}
          />
        </VisualCardToolbar>

        <CoordinateSystem
          aria-label={labels.view}
          cameraPosition={[0.4, 1.2, 6.8]}
          cameraTarget={[0.2, 0.8, 0]}
          focus={{
            x: { max: 2.9, min: -2.4 },
            y: { max: 2.6, min: -0.6 },
            z: { max: 0.4, min: -0.4 },
          }}
          showZAxis={false}
          ticks
        >
          <Suspense fallback={null}>
            <DotProductProjection3DScene angle={deg} parts={labels.parts} />
          </Suspense>
        </CoordinateSystem>

        <CoordinateControls />

        <VisualCardFooter>
          <VisualCardFacts>
            <VisualFact
              label={labels.preset}
              value={labels.presets[active] ?? active}
            />
            {labels.dotValue === undefined ? null : (
              <VisualFactTabular
                label={labels.dotValue}
                value={
                  <InlineMath math={quantity(reading.dotProduct, "", 2)} />
                }
              />
            )}
            {labels.projectionLength === undefined ? null : (
              <VisualFactTabular
                label={labels.projectionLength}
                value={
                  <InlineMath
                    math={quantity(reading.projectionLength, "", 2)}
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

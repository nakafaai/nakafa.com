import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { CrossOrder } from "@repo/design-system/components/contents/mathematics/cross/model";
import { evaluateCrossProduct } from "@repo/design-system/components/contents/mathematics/cross/model";
import { Vector3DCrossProductScene } from "@repo/design-system/components/contents/mathematics/cross/scene";
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

/** The step of the angle slider, which the play action sweeps by. */
const ANGLE_STEP = 1;

export function Vector3DCrossProductLab({
  angle,
  description,
  labels,
  orders,
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
    readonly crossMagnitude?: ReactNode;
    readonly directionRule?: ReactNode;
    readonly order: string;
    readonly orders: Readonly<Partial<Record<CrossOrder, string>>>;
    readonly parts: Readonly<
      Record<
        | "coordinateAxes"
        | "crossVector"
        | "curlArc"
        | "parallelogram"
        | "vectorU"
        | "vectorV",
        string
      >
    >;
    readonly view: string;
  };
  readonly orders: readonly [CrossOrder, ...CrossOrder[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<CrossOrder>(orders[0]);
  const [deg, setDeg] = useState(angle.value);
  const quantity = useQuantity();

  const active = Arr.contains(orders, selected) ? selected : orders[0];
  const reading = evaluateCrossProduct(active, deg);

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <ViewReset
          onReset={() => {
            setSelected(orders[0]);
            setDeg(angle.value);
          }}
        />

        <VisualCardToolbar>
          {orders.length > 1 ? (
            <ToggleGroup
              aria-label={labels.order}
              gridColumns={toggleColumns(orders.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(orders, (item) => item === next),
                  setSelected
                );
              }}
              type="single"
              value={active}
              variant="outline"
            >
              {Arr.map(orders, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.orders[id] ?? id}
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
            step={ANGLE_STEP}
            value={deg}
          />
        </VisualCardToolbar>

        <CoordinateSystem
          aria-label={labels.view}
          cameraFraming="focus"
          cameraPosition={[4.2, 3.2, 6.4]}
          cameraTarget={[1.2, 0.6, -0.5]}
          focus={{
            x: { max: 3.6, min: -0.2 },
            y:
              active === "uCrossV"
                ? { max: 3.2, min: -0.2 }
                : { max: 0.2, min: -3.2 },
            z: { max: 0.2, min: -1.6 },
          }}
          showZAxis
          ticks
        >
          <Suspense fallback={null}>
            <Vector3DCrossProductScene
              angle={deg}
              order={active}
              parts={labels.parts}
              sweep={{
                initial: angle.value,
                max: angle.max,
                min: angle.min,
                onValue: setDeg,
                step: ANGLE_STEP,
              }}
            />
          </Suspense>
        </CoordinateSystem>

        <CoordinateControls />

        <VisualCardFooter>
          <VisualCardFacts>
            <VisualFact
              label={labels.order}
              value={labels.orders[active] ?? active}
            />
            {labels.crossMagnitude === undefined ? null : (
              <VisualFactTabular
                label={labels.crossMagnitude}
                value={<InlineMath math={quantity(reading.area, "", 2)} />}
              />
            )}
            {labels.directionRule === undefined ? null : (
              <VisualFactTabular
                label={labels.directionRule}
                value={
                  <InlineMath
                    math={reading.sign > 0 ? "+\\hat{n}" : "-\\hat{n}"}
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

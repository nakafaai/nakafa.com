import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { ParallelepipedConfig } from "@repo/design-system/components/contents/mathematics/parallelepiped/model";
import { evaluateParallelepiped } from "@repo/design-system/components/contents/mathematics/parallelepiped/model";
import { VectorParallelepipedScene } from "@repo/design-system/components/contents/mathematics/parallelepiped/scene";
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

export function VectorParallelepipedLab({
  configurations,
  description,
  elevation,
  labels,
  title,
}: {
  readonly configurations: readonly [
    ParallelepipedConfig,
    ...ParallelepipedConfig[],
  ];
  readonly description: NonNullable<ReactNode>;
  readonly elevation: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly labels: {
    readonly configuration: string;
    readonly configurations: Readonly<
      Partial<
        Record<
          ParallelepipedConfig,
          { readonly name: ReactNode; readonly summary: ReactNode }
        >
      >
    >;
    readonly coplanarityNote?: ReactNode;
    readonly elevation: string;
    readonly parts: Readonly<
      Record<
        | "altitudeLine"
        | "baseParallelogram"
        | "parallelepipedMesh"
        | "vectorU"
        | "vectorV"
        | "vectorW",
        string
      >
    >;
    readonly tripleVolume?: ReactNode;
    readonly view: string;
  };
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<ParallelepipedConfig>(
    configurations[0]
  );
  const [elev, setElev] = useState(elevation.value);
  const quantity = useQuantity();

  const active = Arr.contains(configurations, selected)
    ? selected
    : configurations[0];
  const reading = evaluateParallelepiped(active, elev);
  const copy = labels.configurations[active];

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <ViewReset
          onReset={() => {
            setSelected(configurations[0]);
            setElev(elevation.value);
          }}
        />

        <VisualCardToolbar>
          {configurations.length > 1 ? (
            <ToggleGroup
              aria-label={labels.configuration}
              gridColumns={toggleColumns(configurations.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(configurations, (item) => item === next),
                  setSelected
                );
              }}
              type="single"
              value={active}
              variant="outline"
            >
              {Arr.map(configurations, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.configurations[id]?.name ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          <VisualSlider
            heading={labels.elevation}
            label={labels.elevation}
            max={elevation.max}
            min={elevation.min}
            onValueChange={setElev}
            readout={<InlineMath math={quantity(elev, "^\\circ", 0)} />}
            step={1}
            value={elev}
          />
        </VisualCardToolbar>

        <CoordinateSystem
          aria-label={labels.view}
          cameraPosition={[5.2, 3.8, 5.4]}
          cameraTarget={[1.0, 0.7, 0.7]}
          focus={{
            x: { max: 3.2, min: -0.4 },
            y: { max: 2.2, min: -0.4 },
            z: { max: 2.4, min: -0.4 },
          }}
          showZAxis
          ticks
        >
          <Suspense fallback={null}>
            <VectorParallelepipedScene
              configuration={active}
              elevation={elev}
              parts={labels.parts}
            />
          </Suspense>
        </CoordinateSystem>

        <CoordinateControls />

        <VisualCardFooter>
          <VisualCardFacts>
            {copy === undefined ? null : (
              <VisualFact label={labels.configuration} value={copy.summary} />
            )}
            {labels.tripleVolume === undefined ? null : (
              <VisualFactTabular
                label={labels.tripleVolume}
                value={<InlineMath math={quantity(reading.volume, "", 2)} />}
              />
            )}
            {labels.coplanarityNote === undefined ? null : (
              <VisualFactTabular
                label={labels.coplanarityNote}
                value={
                  <InlineMath math={reading.coplanar ? "V = 0" : "V > 0"} />
                }
              />
            )}
          </VisualCardFacts>
        </VisualCardFooter>
      </VisualCard>
    </CoordinateProvider>
  );
}

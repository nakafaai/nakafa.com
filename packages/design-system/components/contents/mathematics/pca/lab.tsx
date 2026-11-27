import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type { PcaSubspace } from "@repo/design-system/components/contents/mathematics/pca/model";
import { evaluatePcaProjection } from "@repo/design-system/components/contents/mathematics/pca/model";
import { PcaProjection3DScene } from "@repo/design-system/components/contents/mathematics/pca/scene";
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

export function PcaProjection3DLab({
  correlation,
  description,
  labels,
  subspaces,
  title,
}: {
  readonly correlation: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly correlation: string;
    readonly parts: Readonly<
      Record<
        | "pc1Axis"
        | "pc2Axis"
        | "pc3Axis"
        | "pointCloud"
        | "projectionPlane"
        | "residualLines",
        string
      >
    >;
    readonly reconstructionError?: ReactNode;
    readonly subspace: string;
    readonly subspaces: Readonly<
      Partial<
        Record<
          PcaSubspace,
          { readonly name: ReactNode; readonly summary: ReactNode }
        >
      >
    >;
    readonly varianceExplained?: ReactNode;
    readonly view: string;
  };
  readonly subspaces: readonly [PcaSubspace, ...PcaSubspace[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<PcaSubspace>(subspaces[0]);
  const [corr, setCorr] = useState(correlation.value);
  const quantity = useQuantity();

  const active = Arr.contains(subspaces, selected) ? selected : subspaces[0];
  const reading = evaluatePcaProjection(active, corr);
  const copy = labels.subspaces[active];

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <ViewReset
          onReset={() => {
            setSelected(subspaces[0]);
            setCorr(correlation.value);
          }}
        />

        <VisualCardToolbar>
          {subspaces.length > 1 ? (
            <ToggleGroup
              aria-label={labels.subspace}
              gridColumns={toggleColumns(subspaces.length)}
              onValueChange={(next: string) => {
                Option.map(
                  Arr.findFirst(subspaces, (item) => item === next),
                  setSelected
                );
              }}
              type="single"
              value={active}
              variant="outline"
            >
              {Arr.map(subspaces, (id) => (
                <ToggleGroupItem key={id} value={id}>
                  {labels.subspaces[id]?.name ?? id}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}

          <VisualSlider
            heading={labels.correlation}
            label={labels.correlation}
            max={correlation.max}
            min={correlation.min}
            onValueChange={setCorr}
            readout={<InlineMath math={quantity(corr, "", 2)} />}
            step={0.02}
            value={corr}
          />
        </VisualCardToolbar>

        <CoordinateSystem
          aria-label={labels.view}
          cameraPosition={[4.8, 3.6, 5.4]}
          cameraTarget={[0, 0.2, 0]}
          focus={{
            x: { max: 2.8, min: -2.8 },
            y: { max: 1.6, min: -1.2 },
            z: { max: 2.0, min: -2.0 },
          }}
          showZAxis
          ticks
        >
          <Suspense fallback={null}>
            <PcaProjection3DScene
              correlation={corr}
              parts={labels.parts}
              subspace={active}
            />
          </Suspense>
        </CoordinateSystem>

        <CoordinateControls />

        <VisualCardFooter>
          <VisualCardFacts>
            {copy === undefined ? null : (
              <VisualFact label={labels.subspace} value={copy.summary} />
            )}
            {labels.varianceExplained === undefined ? null : (
              <VisualFactTabular
                label={labels.varianceExplained}
                value={
                  <InlineMath
                    math={quantity(reading.varianceExplainedPercent, "\\%", 0)}
                  />
                }
              />
            )}
            {labels.reconstructionError === undefined ? null : (
              <VisualFactTabular
                label={labels.reconstructionError}
                value={
                  <InlineMath
                    math={quantity(reading.reconstructionMse, "", 3)}
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

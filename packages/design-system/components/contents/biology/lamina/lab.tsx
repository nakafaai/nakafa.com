import type {
  ChloroplastDensity,
  LeafLayer,
} from "@repo/design-system/components/contents/biology/lamina/model";
import { leafLayerSpec } from "@repo/design-system/components/contents/biology/lamina/model";
import { LeafLaminaScene } from "@repo/design-system/components/contents/biology/lamina/scene";
import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import { toggleColumns } from "@repo/design-system/components/contents/simulation/columns";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import {
  VisualFact,
  VisualFactIndicator,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function LeafLaminaCrossSectionLab({
  description,
  labels,
  layers,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: {
    readonly adaptation?: ReactNode;
    readonly chloroplasts?: ReactNode;
    readonly densities: Readonly<Record<ChloroplastDensity, string>>;
    readonly layer: string;
    readonly layers: Readonly<
      Partial<
        Record<
          LeafLayer,
          { readonly adaptation: ReactNode; readonly name: string }
        >
      >
    >;
    readonly parts: Readonly<
      Record<
        "airSpace" | "chloroplast" | "guardCell" | "phloem" | "xylem",
        string
      >
    >;
    readonly view: string;
  };
  readonly layers: readonly [LeafLayer, ...LeafLayer[]];
  readonly title: NonNullable<ReactNode>;
}) {
  const [selected, setSelected] = useState<LeafLayer>(layers[0]);
  const active = Arr.contains(layers, selected) ? selected : layers[0];
  const spec = leafLayerSpec(active);
  const copy = labels.layers[active];

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset onReset={() => setSelected(layers[0])} />

      {layers.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.layer}
            gridColumns={toggleColumns(layers.length)}
            onValueChange={(next: string) => {
              Option.map(
                Arr.findFirst(layers, (item) => item === next),
                setSelected
              );
            }}
            type="single"
            value={active}
            variant="outline"
          >
            {Arr.map(layers, (id) => (
              <ToggleGroupItem key={id} value={id}>
                {labels.layers[id]?.name ?? id}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </VisualCardToolbar>
      ) : null}

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.2} setting="lab">
          <Suspense fallback={null}>
            <LeafLaminaScene activeLayer={active} parts={labels.parts} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          {copy === undefined ? null : (
            <VisualFact label={labels.layer} value={copy.name} />
          )}
          {labels.chloroplasts === undefined ? null : (
            <VisualFactIndicator
              indicatorColor={
                spec.density === "none"
                  ? FOLIAGE_COLORS.cuticle
                  : FOLIAGE_COLORS.chloroplast
              }
              label={labels.chloroplasts}
              value={labels.densities[spec.density]}
            />
          )}
          {labels.adaptation === undefined || copy === undefined ? null : (
            <VisualFact label={labels.adaptation} value={copy.adaptation} />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

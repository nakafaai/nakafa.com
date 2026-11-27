import type {
  Liquid,
  PouredLayer,
} from "@repo/design-system/components/contents/physics/optics/depth/scene";
import { DepthScene } from "@repo/design-system/components/contents/physics/optics/depth/scene";
import { apparentDepth } from "@repo/design-system/components/contents/physics/optics/ray";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface ApparentDepthLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    apparent: ReactNode;
    image: ReactNode;
    liquids: Record<Liquid, ReactNode>;
    real: ReactNode;
    top: string;
    viewLabel: string;
  };
  /** The liquids in the container, from the top layer down. */
  layers: Arr.NonEmptyReadonlyArray<PouredLayer>;
  title: NonNullable<ReactNode>;
}

/**
 * A coin on the floor of a glass tank holding one or more liquids in
 * layers, seen straight down through a viewing lens above. Each layer looks shallower
 * than it is, its thickness over its refractive index, so the coin's image
 * floats above the floor. Pour or remove the top layers and read where the
 * image moves, measured up from the floor where the coin stays.
 */
export function ApparentDepthLab({
  description,
  labels,
  layers,
  title,
}: ApparentDepthLabProps) {
  const quantity = useQuantity();
  const [top, setTop] = useState(0);
  const remaining = Arr.drop(layers, top);
  const shown = Arr.isReadonlyArrayNonEmpty(remaining) ? remaining : layers;
  const capacity = Arr.reduce(layers, 0, (sum, layer) => sum + layer.thickness);
  const depth = apparentDepth(shown);

  return (
    <VisualCard
      onReset={() => {
        setTop(0);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.top}
          onValueChange={(value) => setTop(Number(value))}
          type="single"
          value={String(top)}
          variant="outline"
        >
          {Arr.map(
            Arr.map(layers, (layer, index) => ({
              liquid: layer.liquid,
              value: String(index),
            })),
            (item) => (
              <ToggleGroupItem key={item.value} value={item.value}>
                {labels.liquids[item.liquid]}
              </ToggleGroupItem>
            )
          )}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage
          floor={0}
          frameloop="always"
          ground="epoxy"
          reach={4}
          setting="lab"
        >
          <Suspense fallback={null}>
            <DepthScene capacity={capacity} layers={shown} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.real}
            value={<InlineMath math={quantity(depth.real, "\\text{ cm}", 1)} />}
          />
          <VisualFactTabular
            label={labels.apparent}
            value={
              <InlineMath math={quantity(depth.apparent, "\\text{ cm}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.image}
            value={
              <InlineMath math={quantity(depth.image, "\\text{ cm}", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

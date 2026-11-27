import { FloatingBlockScene } from "@repo/design-system/components/contents/physics/fluid/float/scene";
import { floatIn } from "@repo/design-system/components/contents/physics/fluid/pressure";
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
import { Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

/** The two liquids the block floats in. */
const LiquidSchema = Schema.Literals(["water", "other"]);

type Liquid = typeof LiquidSchema.Type;

interface FloatingBlockLabProps {
  /** The density of the second liquid, in g cm⁻³, with water at 1.0. */
  density: number;
  description: NonNullable<ReactNode>;
  labels: {
    above: ReactNode;
    liquid: string;
    liquids: Record<Liquid, ReactNode>;
    under: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
  /** The volume of the block below the water surface, in cm³. */
  underWater: number;
  /** The volume of the block, in cm³. */
  volume: number;
}

/**
 * A wooden block floats in a tank of water, then in a lighter liquid. Its
 * mass never changes, so it always displaces that same mass of liquid: in
 * the lighter liquid that takes a larger volume, and the block sits deeper.
 */
export function FloatingBlockLab({
  density,
  description,
  labels,
  title,
  underWater,
  volume,
}: FloatingBlockLabProps) {
  const quantity = useQuantity();
  const [liquid, setLiquid] = useState<Liquid>("water");
  const isLiquid = Schema.is(LiquidSchema);
  const floating = floatIn(
    volume,
    underWater,
    liquid === "water" ? 1 : density
  );

  return (
    <VisualCard
      onReset={() => {
        setLiquid("water");
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.liquid}
          onValueChange={(value) => {
            if (isLiquid(value)) {
              setLiquid(value);
            }
          }}
          type="single"
          value={liquid}
          variant="outline"
        >
          <ToggleGroupItem value="water">
            {labels.liquids.water}
          </ToggleGroupItem>
          <ToggleGroupItem value="other">
            {labels.liquids.other}
          </ToggleGroupItem>
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={2.2} setting="lab">
          <Suspense fallback={null}>
            <FloatingBlockScene
              above={floating.above}
              oil={liquid === "other"}
              share={floating.under / volume}
              under={floating.under}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.under}
            value={
              <InlineMath math={quantity(floating.under, "\\text{ cm}^3", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.above}
            value={
              <InlineMath math={quantity(floating.above, "\\text{ cm}^3", 0)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

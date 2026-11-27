import {
  BoltQuantitySchema,
  boltQuantities,
} from "@repo/design-system/components/contents/physics/measurement/bolt/quantities";
import { BoltScene } from "@repo/design-system/components/contents/physics/measurement/bolt/scene";
import { useFixed } from "@repo/design-system/components/contents/physics/measurement/digits";
import { scientific } from "@repo/design-system/components/contents/physics/measurement/figures";
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
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

/** The units of each quantity, as KaTeX. */
const UNITS = {
  area: "\\text{ m}^2",
  density: "\\text{ kg/m}^3",
  diameter: "\\text{ m}",
  length: "\\text{ m}",
  mass: "\\text{ kg}",
  volume: "\\text{ m}^3",
} as const satisfies Record<typeof BoltQuantitySchema.Type, string>;

/** A dimension as KaTeX from its powers of mass and length: [M], [L]^2, [M][L]^{-3}. */
function dimensionOf(mass: number, length: number) {
  const part = (symbol: string, power: number) => {
    if (power === 0) {
      return "";
    }
    return power === 1
      ? `[\\mathrm{${symbol}}]`
      : `[\\mathrm{${symbol}}]^{${power}}`;
  };
  return `${part("M", mass)}${part("L", length)}`;
}

interface BoltDimensionsLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    chooseQuantity: string;
    dimension: ReactNode;
    quantities: Record<typeof BoltQuantitySchema.Type, ReactNode>;
    value: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
}

/**
 * One M10 bolt and six quantities: its length and diameter, its shank's
 * cross-section and volume, its mass, and the density of its steel. Each
 * quantity marks its part of the bolt and shows its value and dimension.
 */
export function BoltDimensionsLab({
  description,
  labels,
  title,
}: BoltDimensionsLabProps) {
  const [quantity, setQuantity] =
    useState<typeof BoltQuantitySchema.Type>("length");
  const fixed = useFixed();
  const shown = boltQuantities()[quantity];
  const value = scientific(shown.value, 3);
  const isQuantity = Schema.is(BoltQuantitySchema);
  const weighed = quantity === "mass" || quantity === "density";

  return (
    <VisualCard
      onReset={() => {
        setQuantity("length");
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseQuantity}
          gridColumns="3"
          onValueChange={(next) => {
            if (isQuantity(next)) {
              setQuantity(next);
            }
          }}
          type="single"
          value={quantity}
          variant="outline"
        >
          {Arr.map(BoltQuantitySchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.quantities[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage
          floor={0}
          ground="epoxy"
          reach={weighed ? 2.4 : 0.9}
          setting="lab"
        >
          <Suspense fallback={null}>
            <BoltScene quantity={quantity} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.value}
            value={
              <InlineMath
                math={`${fixed(value.coefficient, "", 2)}\\times10^{${value.exponent}}${UNITS[quantity]}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.dimension}
            value={<InlineMath math={dimensionOf(shown.mass, shown.length)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

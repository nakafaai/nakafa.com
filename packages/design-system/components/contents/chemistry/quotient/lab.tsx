import { ViewReset } from "@repo/design-system/components/contents/biology/reset";
import type {
  QuotientDirection,
  Stoichiometry,
} from "@repo/design-system/components/contents/chemistry/quotient/model";
import { evaluateQuotient } from "@repo/design-system/components/contents/chemistry/quotient/model";
import { QuotientBalanceScene } from "@repo/design-system/components/contents/chemistry/quotient/scene";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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
  VisualFactTabular,
} from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { EQUILIBRIUM_COLORS } from "@repo/design-system/lib/material/equilibrium";
import { Match } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

export function EquilibriumQuotientLab({
  description,
  kc,
  labels,
  product: productRange,
  reactant: reactantRange,
  stoichiometry,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly kc: number;
  readonly labels: {
    readonly direction?: ReactNode;
    readonly directions: Readonly<Record<QuotientDirection, ReactNode>>;
    readonly equation: ReactNode;
    readonly kc: ReactNode;
    readonly product: string;
    readonly quotient?: ReactNode;
    readonly reactant: string;
    readonly view: string;
  };
  readonly product: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly reactant: {
    readonly max: number;
    readonly min: number;
    readonly value: number;
  };
  readonly stoichiometry: Stoichiometry;
  readonly title: NonNullable<ReactNode>;
}) {
  const [reactant, setReactant] = useState(reactantRange.value);
  const [product, setProduct] = useState(productRange.value);
  const quantity = useQuantity();

  const snapshot = evaluateQuotient(reactant, product, kc, stoichiometry);
  const indicator = Match.value(snapshot.direction).pipe(
    Match.when("forward", () => EQUILIBRIUM_COLORS.forwardArrow),
    Match.when("equilibrium", () => EQUILIBRIUM_COLORS.balancedGlow),
    Match.when("reverse", () => EQUILIBRIUM_COLORS.reverseArrow),
    Match.exhaustive
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <ViewReset
        onReset={() => {
          setReactant(reactantRange.value);
          setProduct(productRange.value);
        }}
      />

      <VisualCardToolbar>
        <VisualSlider
          heading={labels.reactant}
          label={labels.reactant}
          max={reactantRange.max}
          min={reactantRange.min}
          onValueChange={setReactant}
          readout={<InlineMath math={quantity(reactant, "\\text{ M}", 2)} />}
          step={0.05}
          value={reactant}
        />
        <VisualSlider
          heading={labels.product}
          label={labels.product}
          max={productRange.max}
          min={productRange.min}
          onValueChange={setProduct}
          readout={<InlineMath math={quantity(product, "\\text{ M}", 2)} />}
          step={0.05}
          value={product}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} ground="epoxy" reach={2.4} setting="lab">
          <Suspense fallback={null}>
            <QuotientBalanceScene
              direction={snapshot.direction}
              productLabel={labels.product}
              productRatio={product / Math.max(0.01, productRange.max)}
              reactantLabel={labels.reactant}
              reactantRatio={reactant / Math.max(0.01, reactantRange.max)}
              tiltRad={snapshot.tiltRad}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.reactant} value={labels.equation} />
          <VisualFactTabular
            label={labels.kc}
            value={<InlineMath math={quantity(kc, "", 2)} />}
          />
          {labels.quotient === undefined ? null : (
            <VisualFactTabular
              label={labels.quotient}
              value={<InlineMath math={quantity(snapshot.qc, "", 2)} />}
            />
          )}
          {labels.direction === undefined ? null : (
            <VisualFactIndicator
              indicatorColor={indicator}
              label={labels.direction}
              value={labels.directions[snapshot.direction]}
            />
          )}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

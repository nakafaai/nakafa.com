import {
  CombustionCamera,
  CombustionScene,
} from "@repo/design-system/components/contents/chemistry/methane-combustion-equation/scene";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { useTranslations } from "use-intl";

interface MethaneCombustionEquationLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    equation: ReactNode;
    moleculeView: string;
    products: string;
    reactants: string;
  };
  title: NonNullable<ReactNode>;
}

export function MethaneCombustionEquationLab({
  description,
  labels,
  title,
}: MethaneCombustionEquationLabProps) {
  const t = useTranslations("Common");

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody
        aria-label={labels.moleculeView}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={1.2} setting="lab">
          <Suspense fallback={null}>
            <CombustionCamera />
            <CombustionScene
              productsLabel={labels.products}
              reactantsLabel={labels.reactants}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={t("equation")} value={labels.equation} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

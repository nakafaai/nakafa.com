import type { MathVisual as MathVisualScene } from "@nakafa/aksara-contracts/math/visual";
import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import {
  VisualCard,
  VisualCardBody,
  VisualCardHeader,
  VisualCardScene,
} from "@repo/design-system/components/visual/card";
import { type ReactNode, useId } from "react";

import { DeferredMathScene } from "@/lib/content/renderer/client/base/visual/deferred";

const EMPTY_LABELS: Readonly<Record<string, ReactNode>> = {};

interface Props {
  readonly description: ReactNode;
  readonly labels?: Readonly<Record<string, ReactNode>>;
  readonly scene: MathVisualScene;
  readonly title: ReactNode;
}

/** Renders one stable mathematical scene without content-specific components. */
export function MathVisual({
  description,
  labels = EMPTY_LABELS,
  scene,
  title,
}: Props) {
  const identifier = useId();
  const descriptionId = `${identifier}-description`;
  const titleId = `${identifier}-title`;

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader
          description={<span id={descriptionId}>{description}</span>}
          title={<span id={titleId}>{title}</span>}
        />
        <VisualCardBody>
          <VisualCardScene
            aria-describedby={descriptionId}
            aria-labelledby={titleId}
            className="m-0"
            render={<figure />}
          >
            <DeferredMathScene labels={labels} scene={scene} />
          </VisualCardScene>
        </VisualCardBody>
        <CoordinateControls />
      </VisualCard>
    </CoordinateProvider>
  );
}

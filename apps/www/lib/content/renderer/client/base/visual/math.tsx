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
  /** The lesson's description of the scene. A visual without a title shows none. */
  readonly description?: ReactNode;
  readonly labels?: Readonly<Record<string, ReactNode>>;
  readonly scene: MathVisualScene;
  readonly title?: ReactNode;
  /** The name of the figure when the visual has no title, such as on the home page. */
  readonly viewLabel?: string;
}

/** Renders one stable mathematical scene without content-specific components. */
export function MathVisual({
  description,
  labels = EMPTY_LABELS,
  scene,
  title,
  viewLabel,
}: Props) {
  const identifier = useId();
  const descriptionId = `${identifier}-description`;
  const titleId = `${identifier}-title`;
  const figureName = title === undefined ? viewLabel : undefined;

  return (
    <CoordinateProvider>
      <VisualCard>
        <VisualCardHeader
          description={
            description === undefined ? undefined : (
              <span id={descriptionId}>{description}</span>
            )
          }
          title={
            title === undefined ? undefined : <span id={titleId}>{title}</span>
          }
        />
        <VisualCardBody>
          <VisualCardScene
            aria-describedby={
              title === undefined || description === undefined
                ? undefined
                : descriptionId
            }
            aria-label={figureName}
            aria-labelledby={title === undefined ? undefined : titleId}
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

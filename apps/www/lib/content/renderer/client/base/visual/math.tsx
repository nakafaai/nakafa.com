import type { MathVisual as MathVisualScene } from "@nakafa/aksara-contracts/math/visual";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { type ReactNode, useId } from "react";

import { DeferredMathSpace } from "@/lib/content/renderer/client/base/visual/deferred";
import { MathPlane } from "@/lib/content/renderer/client/base/visual/plane";

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
    <Card className="content-auto-card">
      <CardHeader>
        <CardTitle id={titleId}>{title}</CardTitle>
        <CardDescription id={descriptionId}>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <figure
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          className="m-0"
        >
          {scene.space === "plane" ? (
            <MathPlane labels={labels} scene={scene} />
          ) : (
            <DeferredMathSpace labels={labels} scene={scene} />
          )}
        </figure>
      </CardContent>
    </Card>
  );
}

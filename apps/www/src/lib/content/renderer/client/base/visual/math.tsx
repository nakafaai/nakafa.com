"use client";

import type { MathVisual as MathVisualScene } from "@nakafa/aksara-contracts/math/visual";
import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import {
  VisualCard,
  VisualCardBody,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { type ReactNode, useId } from "react";

import { DeferredMathScene } from "@/lib/content/renderer/client/base/visual/deferred";
import { MathReadouts } from "@/lib/content/renderer/client/base/visual/readouts";
import {
  ParameterProvider,
  ParameterSliders,
} from "@/lib/content/renderer/client/base/visual/sliders";

interface Props {
  readonly description: ReactNode;
  readonly labels?: Readonly<Record<string, ReactNode>>;
  readonly scene: MathVisualScene;
  readonly title: ReactNode;
}

/** Renders one stable mathematical scene without content-specific components. */
export function MathVisual({ description, title, ...scene }: Props) {
  const readouts =
    scene.scene.space === "plane" ? (scene.scene.readouts ?? []) : [];
  const identifier = useId();
  const descriptionId = `${identifier}-description`;
  const titleId = `${identifier}-title`;

  return (
    <CoordinateProvider>
      <ParameterProvider
        labels={scene.labels ?? {}}
        parameters={scene.scene.parameters ?? []}
        readouts={readouts}
      >
        <VisualCard>
          <VisualCardHeader
            description={<span id={descriptionId}>{description}</span>}
            title={<span id={titleId}>{title}</span>}
          />
          <ParameterSliders />
          <VisualCardBody
            aria-describedby={descriptionId}
            aria-labelledby={titleId}
            className="relative m-0"
            data-scene="math"
            render={<figure />}
          >
            <DeferredMathScene {...scene} />
          </VisualCardBody>
          <CoordinateControls />
          <MathReadouts />
        </VisualCard>
      </ParameterProvider>
    </CoordinateProvider>
  );
}

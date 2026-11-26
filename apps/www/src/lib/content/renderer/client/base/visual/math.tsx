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
import type { ReactNode } from "react";
import { useId } from "react";

import { DeferredMathScene } from "@/lib/content/renderer/client/base/visual/deferred";
import { MathReadouts } from "@/lib/content/renderer/client/base/visual/readouts";
import {
  ParameterProvider,
  ParameterSliders,
} from "@/lib/content/renderer/client/base/visual/sliders";

interface Props {
  readonly description: ReactNode;
  /** Accepted for compiled corpus compatibility; never rendered as a second or plain-text footer. */
  readonly footer?: ReactNode;
  readonly labels?: Readonly<Record<string, ReactNode>>;
  readonly scene: MathVisualScene;
  readonly title: ReactNode;
}

/** Renders one stable mathematical scene without content-specific components. */
export function MathVisual({ description, labels, scene, title }: Props) {
  const readouts = scene.space === "plane" ? (scene.readouts ?? []) : [];
  const identifier = useId();
  const descriptionId = `${identifier}-description`;
  const titleId = `${identifier}-title`;

  return (
    <CoordinateProvider>
      <ParameterProvider
        labels={labels ?? {}}
        parameters={scene.parameters ?? []}
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
            <DeferredMathScene
              {...(labels === undefined ? {} : { labels })}
              scene={scene}
            />
          </VisualCardBody>
          <CoordinateControls />
          <MathReadouts />
        </VisualCard>
      </ParameterProvider>
    </CoordinateProvider>
  );
}

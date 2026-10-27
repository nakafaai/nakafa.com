import {
  type TriangleLabels,
  TriangleProvider,
  useTriangle,
} from "@repo/design-system/components/contents/mathematics/triangle/context";
import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import { ScenePlaceholder } from "@repo/design-system/components/three/placeholder";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@repo/design-system/components/ui/number";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { ISOSCELES_RIGHT_TRIANGLE_ANGLE } from "@repo/math/angles";
import { ClientOnly } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { lazy, Suspense, useState } from "react";
import { useTranslations } from "use-intl";

// The client-only import boundary keeps offscreen lessons from loading WebGL.
const TriangleScene = lazy(() =>
  import(
    "@repo/design-system/components/contents/mathematics/triangle/scene"
  ).then((module) => ({ default: module.TriangleScene }))
);

// Keep KaTeX outside the page's initial component graph until the scene is visible.
const TriangleReadout = lazy(() =>
  import(
    "@repo/design-system/components/contents/mathematics/triangle/readout"
  ).then((module) => ({ default: module.TriangleReadout }))
);

interface Props {
  angle?: number;
  description: ReactNode;
  labels?: TriangleLabels;
  size?: number;
  title: ReactNode;
}

export function Triangle({
  title,
  description,
  angle = ISOSCELES_RIGHT_TRIANGLE_ANGLE,
  size = 2,
  labels = {
    opposite: "Opposite",
    adjacent: "Adjacent",
    hypotenuse: "Hypotenuse",
  },
}: Props) {
  const config = { angle, labels, size };

  return (
    <CoordinateProvider>
      <TriangleProvider config={config}>
        <VisualCard>
          <VisualCardHeader description={description} title={title} />
          <Content />
        </VisualCard>
      </TriangleProvider>
    </CoordinateProvider>
  );
}

function Content() {
  const t = useTranslations("Common");
  const { angle } = useTriangle();
  const [angleOverride, setAngleOverride] = useState<number | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const angleValue = angleOverride ?? angle;

  return (
    <>
      <VisualCardToolbar>
        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
          <NumberField
            onValueChange={(value) => {
              if (value !== null) {
                setAngleOverride(value);
              }
            }}
            value={angleValue}
          >
            <NumberFieldGroup>
              <NumberFieldDecrement aria-label={t("decrease-angle")} />
              <NumberFieldInput
                aria-label={t("angle")}
                className="font-mono"
                placeholder={`${angle}`}
              />
              <NumberFieldIncrement aria-label={t("increase-angle")} />
            </NumberFieldGroup>
          </NumberField>
        </div>
      </VisualCardToolbar>
      <VisualCardBody className="relative" data-scene="triangle">
        {isNearViewport ? (
          <Suspense fallback={<ScenePlaceholder />}>
            <ClientOnly fallback={<ScenePlaceholder />}>
              <TriangleScene angle={angleValue} />
            </ClientOnly>
          </Suspense>
        ) : (
          <ScenePlaceholder />
        )}
        {/* Last, so the scene or its stand-in is the body's first child. */}
        <Intersection
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          once
          onIntersect={() => setIsNearViewport(true)}
        />
      </VisualCardBody>
      <CoordinateControls />
      {isNearViewport ? (
        <VisualCardFooter>
          <Suspense fallback={null}>
            <ClientOnly fallback={null}>
              <TriangleReadout angle={angleValue} />
            </ClientOnly>
          </Suspense>
        </VisualCardFooter>
      ) : null}
    </>
  );
}

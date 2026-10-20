"use client";

import { useThree } from "@react-three/fiber";
import {
  CAMERA_POSITION,
  CAMERA_TARGET,
  formatSigned,
  getSceneColors,
  NARROW_CAMERA_POSITION,
} from "@repo/design-system/components/contents/physics/vector/concept/data";
import { VectorConceptScene } from "@repo/design-system/components/contents/physics/vector/concept/scene";
import {
  getVectorState,
  LOAD_MAX_X,
  LOAD_MIN_X,
  LOAD_STEP,
} from "@repo/design-system/components/contents/physics/vector/concept/tension";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import {
  isNarrowThreeScene,
  threeSceneFrameVariants,
} from "@repo/design-system/components/three/scene-frame";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { useTheme } from "@repo/design-system/providers/theme";
import { Effect } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";

const NARROW_CANVAS_ASPECT_RATIO = 1.28;

export interface VectorConceptLabProps {
  description: ReactNode;
  labels: {
    bridgeView: string;
    chooseLoadPosition: string;
    direction: string;
    directionValue: string;
    leftCable: ReactNode;
    magnitude: string;
    magnitudeValue: string;
    netIdea: string;
    netIdeaValue: string;
    rightCable: ReactNode;
  };
  title: ReactNode;
}

/**
 * Renders an interactive bridge-tension model for the first vector concept.
 *
 * The scene uses demand rendering because it changes only when students move
 * the load or inspect the camera.
 *
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance
 */
export function VectorConceptLab({
  title,
  description,
  labels,
}: VectorConceptLabProps) {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const [loadX, setLoadX] = useState(0);
  const colors = getSceneColors(resolvedTheme);
  const vectorState = useMemo(
    () => Effect.runSync(getVectorState(loadX)),
    [loadX]
  );

  function handleLoadChange(nextValue: number) {
    setLoadX(nextValue);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <div>{labels.chooseLoadPosition}</div>
            <div className="shrink-0 tabular-nums">
              <InlineMath math={`${formatSigned(loadX)} \\text{ m}`} />
            </div>
          </div>
          <Slider
            aria-label={labels.chooseLoadPosition}
            max={LOAD_MAX_X}
            min={LOAD_MIN_X}
            onValueChange={handleLoadChange}
            step={LOAD_STEP}
            value={loadX}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.bridgeView}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ThreeCanvas frameloop="demand">
          <Suspense>
            <ResponsiveVectorConceptCamera />
            <ambientLight intensity={0.72} />
            <hemisphereLight
              color={colors.skyLight}
              groundColor={colors.groundLight}
              intensity={0.64}
            />
            <directionalLight
              castShadow
              intensity={1.35}
              position={[4.5, 6, 4.5]}
              shadow-bias={-0.0006}
              shadow-mapSize-height={1024}
              shadow-mapSize-width={1024}
              shadow-normalBias={0.02}
            />
            <VectorConceptScene
              colors={colors}
              labels={labels}
              vectorState={vectorState}
            />
          </Suspense>
        </ThreeCanvas>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={labels.magnitude} value={labels.magnitudeValue} />
          <VisualFact label={labels.direction} value={labels.directionValue} />
          <VisualFact label={labels.netIdea} value={labels.netIdeaValue} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

function ResponsiveVectorConceptCamera() {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? NARROW_CAMERA_POSITION
    : CAMERA_POSITION;

  return (
    <CameraControls
      cameraPosition={cameraPosition}
      cameraTarget={CAMERA_TARGET}
      fov={44}
    />
  );
}

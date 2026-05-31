"use client";

import { useThree } from "@react-three/fiber";
import {
  CAMERA_POSITION,
  CAMERA_TARGET,
  formatSigned,
  getSceneColors,
  getVectorState,
  LOAD_MAX_X,
  LOAD_MIN_X,
  LOAD_STEP,
  NARROW_CAMERA_POSITION,
  type VectorConceptLabProps,
} from "@repo/design-system/components/contents/physics/vector/concept/data";
import { VectorConceptScene } from "@repo/design-system/components/contents/physics/vector/concept/scene";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import {
  isNarrowThreeScene,
  threeSceneFrameVariants,
} from "@repo/design-system/components/three/scene-frame";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Slider } from "@repo/design-system/components/ui/slider";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { Suspense, useMemo, useState } from "react";

const NARROW_CANVAS_ASPECT_RATIO = 1.28;

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
  const { resolvedTheme } = useTheme();
  const [loadX, setLoadX] = useState(0);
  const colors = getSceneColors(resolvedTheme);
  const vectorState = useMemo(() => getVectorState(loadX), [loadX]);

  function handleLoadChange(nextValue: number) {
    setLoadX(nextValue);
  }

  return (
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <section
          aria-label={labels.bridgeView}
          className={threeSceneFrameVariants()}
        >
          <ThreeCanvas
            camera={{ fov: 44, position: CAMERA_POSITION }}
            frameloop="demand"
          >
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
        </section>

        <div className="flex flex-col gap-3 pt-2">
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
      </CardContent>
      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <LabFact label={labels.magnitude} value={labels.magnitudeValue} />
          <LabFact label={labels.direction} value={labels.directionValue} />
          <LabFact label={labels.netIdea} value={labels.netIdeaValue} />
        </dl>
      </CardFooter>
    </Card>
  );
}

function ResponsiveVectorConceptCamera() {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? NARROW_CAMERA_POSITION
    : CAMERA_POSITION;

  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={cameraPosition}
      cameraTarget={CAMERA_TARGET}
      maxDistance={9.2}
      minDistance={3.2}
    />
  );
}

function LabFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}

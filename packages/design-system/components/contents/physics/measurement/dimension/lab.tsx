"use client";

import { useThree } from "@react-three/fiber";
import {
  AREA_MODE_ID,
  CAMERA_POSITION,
  CAMERA_TARGET,
  DIMENSION_MODES,
  type DimensionLabProps,
  type DimensionModeId,
  getDimensionSceneColors,
  isDimensionModeId,
  LENGTH_MODE_ID,
  NARROW_CAMERA_POSITION,
  VOLUME_MODE_ID,
} from "@repo/design-system/components/contents/physics/measurement/dimension/data";
import { DimensionScene } from "@repo/design-system/components/contents/physics/measurement/dimension/scene";
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
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

const NARROW_CANVAS_ASPECT_RATIO = 1.4;

/**
 * Renders a compact 3D model for visualizing length powers in dimensions.
 *
 * The component uses demand rendering because the scene changes only when
 * students switch modes or move the camera.
 *
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance
 * @see https://openstax.org/books/university-physics-volume-1/pages/1-4-dimensional-analysis
 */
export function DimensionLab({
  title,
  description,
  labels,
}: DimensionLabProps) {
  const { resolvedTheme } = useTheme();
  const [selectedModeId, setSelectedModeId] =
    useState<DimensionModeId>(LENGTH_MODE_ID);
  const selectedMode = DIMENSION_MODES[selectedModeId];
  const sceneColors = getDimensionSceneColors(resolvedTheme);

  /**
   * Keeps the current mode selected when ToggleGroup emits an empty value.
   */
  function handleModeChange(value: string) {
    if (!value) {
      return;
    }

    if (!isDimensionModeId(value)) {
      return;
    }

    setSelectedModeId(value);
  }

  return (
    <Card className="overflow-hidden content-auto-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseMode}
          className="grid w-full grid-cols-3"
          layout="grid"
          onValueChange={handleModeChange}
          type="single"
          value={selectedModeId}
          variant="outline"
        >
          <ToggleGroupItem value={LENGTH_MODE_ID}>
            {labels.modes.length}
          </ToggleGroupItem>
          <ToggleGroupItem value={AREA_MODE_ID}>
            {labels.modes.area}
          </ToggleGroupItem>
          <ToggleGroupItem value={VOLUME_MODE_ID}>
            {labels.modes.volume}
          </ToggleGroupItem>
        </ToggleGroup>

        <div className={threeSceneFrameVariants()}>
          <ThreeCanvas
            camera={{ fov: 45, position: CAMERA_POSITION }}
            frameloop="demand"
          >
            <Suspense>
              <ResponsiveDimensionCamera />
              <ambientLight intensity={0.75} />
              <hemisphereLight
                color={sceneColors.skyLight}
                groundColor={sceneColors.groundLight}
                intensity={0.65}
              />
              <directionalLight intensity={1.3} position={[4, 6, 5]} />
              <DimensionScene
                colors={sceneColors}
                modeId={selectedModeId}
                powerLabel={selectedMode.powerLabel}
              />
            </Suspense>
          </ThreeCanvas>
        </div>
      </CardContent>
      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <DimensionFact
            label={labels.formula}
            value={<InlineMath math={selectedMode.formula} />}
          />
          <DimensionFact
            label={labels.unit}
            value={<InlineMath math={selectedMode.unit} />}
          />
          <DimensionFact
            label={labels.dimension}
            value={<InlineMath math={selectedMode.dimension} />}
          />
        </dl>
      </CardFooter>
    </Card>
  );
}

/**
 * Keeps the block powers readable when the shared 3D frame is square on mobile.
 */
function ResponsiveDimensionCamera() {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? NARROW_CAMERA_POSITION
    : CAMERA_POSITION;

  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={cameraPosition}
      cameraTarget={CAMERA_TARGET}
    />
  );
}

/**
 * Renders one formula fact without badge styling.
 */
function DimensionFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}

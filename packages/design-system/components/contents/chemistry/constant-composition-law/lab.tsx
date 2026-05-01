"use client";

import { useThree } from "@react-three/fiber";
import {
  CONSTANT_COMPOSITION_MODE_IDS,
  CONSTANT_COMPOSITION_SCENE_VIEW,
  type ConstantCompositionLabProps,
  type ConstantCompositionModeId,
  EXACT_RATIO_MODE_ID,
  getConstantCompositionSceneColors,
  isConstantCompositionModeId,
} from "@repo/design-system/components/contents/chemistry/constant-composition-law/data";
import { ConstantCompositionScene } from "@repo/design-system/components/contents/chemistry/constant-composition-law/scene";
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

const NARROW_CANVAS_ASPECT_RATIO = 1.28;

export function ConstantCompositionLab({
  title,
  description,
  labels,
}: ConstantCompositionLabProps) {
  const { resolvedTheme } = useTheme();
  const [selectedModeId, setSelectedModeId] =
    useState<ConstantCompositionModeId>(EXACT_RATIO_MODE_ID);
  const selectedLabels = labels.modes[selectedModeId];
  const sceneColors = getConstantCompositionSceneColors(resolvedTheme);

  function handleModeChange(value: string) {
    if (!value) {
      return;
    }

    if (!isConstantCompositionModeId(value)) {
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
          className="grid w-full grid-cols-1 sm:grid-cols-3"
          layout="grid"
          onValueChange={handleModeChange}
          type="single"
          value={selectedModeId}
          variant="outline"
        >
          {CONSTANT_COMPOSITION_MODE_IDS.map((modeId) => (
            <ToggleGroupItem
              aria-label={labels.modes[modeId].tabLabel}
              key={modeId}
              value={modeId}
            >
              {labels.modes[modeId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <section
          aria-label={labels.reactionView}
          className={threeSceneFrameVariants()}
        >
          <ThreeCanvas
            camera={{
              fov: 43,
              position: CONSTANT_COMPOSITION_SCENE_VIEW.cameraPosition,
            }}
            frameloop="always"
          >
            <Suspense>
              <ConstantCompositionCameraControls />
              <ambientLight intensity={0.7} />
              <hemisphereLight
                color={sceneColors.text}
                groundColor={sceneColors.bond}
                intensity={0.62}
              />
              <directionalLight intensity={1.25} position={[4, 5, 5]} />
              <ConstantCompositionScene
                colors={sceneColors}
                labels={labels}
                modeId={selectedModeId}
              />
            </Suspense>
          </ThreeCanvas>
        </section>

        <p className="text-muted-foreground text-sm">
          {selectedLabels.helperCaption}
        </p>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <LabFact label={labels.ratioLabel} value={selectedLabels.ratio} />
          <LabFact
            label={labels.leftoverLabel}
            value={selectedLabels.leftover}
          />
        </dl>
      </CardFooter>
    </Card>
  );
}

function ConstantCompositionCameraControls() {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? CONSTANT_COMPOSITION_SCENE_VIEW.narrowCameraPosition
    : CONSTANT_COMPOSITION_SCENE_VIEW.cameraPosition;

  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={cameraPosition}
      cameraTarget={CONSTANT_COMPOSITION_SCENE_VIEW.cameraTarget}
      maxDistance={8.6}
      minDistance={2.7}
    />
  );
}

function LabFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}

"use client";

import { useThree } from "@react-three/fiber";
import {
  COMBINING_VOLUMES_MODE_IDS,
  COMBINING_VOLUMES_SCENE_VIEW,
  type CombiningVolumesLabProps,
  type CombiningVolumesModeId,
  getCombiningVolumesSceneColors,
  isCombiningVolumesModeId,
  WATER_VAPOR_MODE_ID,
} from "@repo/design-system/components/contents/chemistry/combining-volumes-law/data";
import { CombiningVolumesScene } from "@repo/design-system/components/contents/chemistry/combining-volumes-law/scene";
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

const NARROW_CANVAS_ASPECT_RATIO = 1.27;

export function CombiningVolumesLab({
  description,
  labels,
  title,
}: CombiningVolumesLabProps) {
  const { resolvedTheme } = useTheme();
  const [selectedModeId, setSelectedModeId] =
    useState<CombiningVolumesModeId>(WATER_VAPOR_MODE_ID);
  const selectedLabels = labels.modes[selectedModeId];
  const sceneColors = getCombiningVolumesSceneColors(resolvedTheme);

  function handleModeChange(value: string) {
    if (!value) {
      return;
    }

    if (!isCombiningVolumesModeId(value)) {
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
          {COMBINING_VOLUMES_MODE_IDS.map((modeId) => (
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
              fov: 42,
              position: COMBINING_VOLUMES_SCENE_VIEW.cameraPosition,
            }}
            frameloop="always"
          >
            <Suspense>
              <CombiningVolumesCameraControls />
              <ambientLight intensity={0.7} />
              <hemisphereLight
                color={sceneColors.text}
                groundColor={sceneColors.bond}
                intensity={0.58}
              />
              <directionalLight intensity={1.25} position={[4, 5, 5]} />
              <CombiningVolumesScene
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
          <LabFact label={labels.exampleLabel} value={selectedLabels.example} />
        </dl>
      </CardFooter>
    </Card>
  );
}

function CombiningVolumesCameraControls() {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? COMBINING_VOLUMES_SCENE_VIEW.narrowCameraPosition
    : COMBINING_VOLUMES_SCENE_VIEW.cameraPosition;

  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={cameraPosition}
      cameraTarget={COMBINING_VOLUMES_SCENE_VIEW.cameraTarget}
      maxDistance={9.5}
      minDistance={3}
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

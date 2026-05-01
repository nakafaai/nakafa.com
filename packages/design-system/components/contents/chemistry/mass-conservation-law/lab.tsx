"use client";

import { useThree } from "@react-three/fiber";
import {
  CLOSED_SYSTEM_MODE_ID,
  getMassConservationSceneColors,
  isMassConservationModeId,
  MASS_CONSERVATION_MODE_IDS,
  MASS_CONSERVATION_SCENE_VIEW,
  type MassConservationLabProps,
  type MassConservationModeId,
} from "@repo/design-system/components/contents/chemistry/mass-conservation-law/data";
import { MassConservationScene } from "@repo/design-system/components/contents/chemistry/mass-conservation-law/scene";
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

const NARROW_CANVAS_ASPECT_RATIO = 1.22;

export function MassConservationLab({
  title,
  description,
  labels,
}: MassConservationLabProps) {
  const { resolvedTheme } = useTheme();
  const [selectedModeId, setSelectedModeId] = useState<MassConservationModeId>(
    CLOSED_SYSTEM_MODE_ID
  );
  const selectedLabels = labels.modes[selectedModeId];
  const sceneColors = getMassConservationSceneColors(resolvedTheme);

  function handleModeChange(value: string) {
    if (!value) {
      return;
    }

    if (!isMassConservationModeId(value)) {
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
          className="grid w-full grid-cols-2"
          layout="grid"
          onValueChange={handleModeChange}
          type="single"
          value={selectedModeId}
          variant="outline"
        >
          {MASS_CONSERVATION_MODE_IDS.map((modeId) => (
            <ToggleGroupItem key={modeId} value={modeId}>
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
              position: MASS_CONSERVATION_SCENE_VIEW.cameraPosition,
            }}
            frameloop="always"
          >
            <Suspense>
              <MassConservationCameraControls />
              <ambientLight intensity={0.68} />
              <hemisphereLight
                color={sceneColors.text}
                groundColor={sceneColors.groundLight}
                intensity={0.58}
              />
              <directionalLight intensity={1.25} position={[4, 5, 5]} />
              <MassConservationScene
                colors={sceneColors}
                labels={labels}
                modeId={selectedModeId}
              />
            </Suspense>
          </ThreeCanvas>
        </section>

        <div className="grid grid-cols-2 gap-3 text-center text-muted-foreground text-sm">
          <p>{selectedLabels.beforeCaption}</p>
          <p>{selectedLabels.afterCaption}</p>
        </div>
      </CardContent>

      <CardFooter className="border-t">
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <LabFact label={labels.systemLabel} value={selectedLabels.system} />
          <LabFact
            label={labels.calculationLabel}
            value={selectedLabels.calculation}
          />
        </dl>
      </CardFooter>
    </Card>
  );
}

function MassConservationCameraControls() {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? MASS_CONSERVATION_SCENE_VIEW.narrowCameraPosition
    : MASS_CONSERVATION_SCENE_VIEW.cameraPosition;

  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={cameraPosition}
      cameraTarget={MASS_CONSERVATION_SCENE_VIEW.cameraTarget}
      maxDistance={9.2}
      minDistance={2.9}
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

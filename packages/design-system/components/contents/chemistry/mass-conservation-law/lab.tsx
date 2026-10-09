"use client";

import { useThree } from "@react-three/fiber";
import {
  CLOSED_SYSTEM_MODE_ID,
  getMassConservationSceneColors,
  isMassConservationModeId,
  MASS_CONSERVATION_MODE_IDS,
  MASS_CONSERVATION_SCENE_VIEW,
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
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardScene,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { Array as Arr } from "effect";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

const NARROW_CANVAS_ASPECT_RATIO = 1.22;

export interface MassConservationLabProps {
  description: ReactNode;
  labels: {
    after: string;
    before: string;
    calculationLabel: string;
    chooseMode: string;
    modes: Record<
      MassConservationModeId,
      {
        calculation: ReactNode;
        helperCaption: ReactNode;
        readoutAfter: ReactNode;
        readoutBefore: ReactNode;
        system: ReactNode;
        tab: string;
      }
    >;
    reactionView: string;
    systemLabel: string;
  };
  title: ReactNode;
}

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
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseMode}
          gridColumns="2"
          onValueChange={handleModeChange}
          type="single"
          value={selectedModeId}
          variant="outline"
        >
          {Arr.map(MASS_CONSERVATION_MODE_IDS, (modeId) => (
            <ToggleGroupItem key={modeId} value={modeId}>
              {labels.modes[modeId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <VisualCardScene
          aria-label={labels.reactionView}
          className={threeSceneFrameVariants()}
          render={<section />}
        >
          <ThreeCanvas frameloop="always">
            <Suspense>
              <MassConservationCameraControls />
              <ambientLight intensity={0.68} />
              <hemisphereLight
                color={sceneColors.text}
                groundColor={sceneColors.groundLight}
                intensity={0.58}
              />
              <directionalLight
                castShadow
                intensity={1.25}
                position={[4, 5, 5]}
                shadow-bias={-0.0006}
                shadow-mapSize-height={1024}
                shadow-mapSize-width={1024}
                shadow-normalBias={0.02}
              />
              <MassConservationScene
                colors={sceneColors}
                labels={labels}
                modeId={selectedModeId}
              />
            </Suspense>
          </ThreeCanvas>
        </VisualCardScene>

        <p className="text-muted-foreground text-sm">
          {selectedLabels.helperCaption}
        </p>
      </VisualCardBody>

      <VisualCardFooter>
        <dl className="grid w-full grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <VisualFact
            label={labels.systemLabel}
            value={selectedLabels.system}
          />
          <VisualFact
            label={labels.calculationLabel}
            value={selectedLabels.calculation}
          />
        </dl>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
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
      fov={42}
    />
  );
}

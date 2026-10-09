"use client";

import { useThree } from "@react-three/fiber";
import {
  CONSTANT_COMPOSITION_MODE_IDS,
  CONSTANT_COMPOSITION_SCENE_VIEW,
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

const NARROW_CANVAS_ASPECT_RATIO = 1.28;

export interface ConstantCompositionLabProps {
  description: ReactNode;
  labels: {
    after: string;
    before: string;
    chooseMode: string;
    leftoverLabel: string;
    modes: Record<
      ConstantCompositionModeId,
      {
        helperCaption: ReactNode;
        leftover: ReactNode;
        ratio: ReactNode;
        readoutAfter: ReactNode;
        readoutBefore: ReactNode;
        tab: ReactNode;
        tabLabel: string;
      }
    >;
    ratioLabel: string;
    reactionView: string;
  };
  title: ReactNode;
}

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
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseMode}
          gridColumns="3"
          onValueChange={handleModeChange}
          type="single"
          value={selectedModeId}
          variant="outline"
        >
          {Arr.map(CONSTANT_COMPOSITION_MODE_IDS, (modeId) => (
            <ToggleGroupItem
              aria-label={labels.modes[modeId].tabLabel}
              key={modeId}
              value={modeId}
            >
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
              <ConstantCompositionCameraControls />
              <ambientLight intensity={0.7} />
              <hemisphereLight
                color={sceneColors.text}
                groundColor={sceneColors.bond}
                intensity={0.62}
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
              <ConstantCompositionScene
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
          <VisualFact label={labels.ratioLabel} value={selectedLabels.ratio} />
          <VisualFact
            label={labels.leftoverLabel}
            value={selectedLabels.leftover}
          />
        </dl>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
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
      fov={43}
    />
  );
}

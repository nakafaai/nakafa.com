"use client";

import { useThree } from "@react-three/fiber";
import { getAtomSceneColors } from "@repo/design-system/components/contents/chemistry/color";
import {
  isMultipleProportionsModeId,
  MULTIPLE_PROPORTIONS_MODE_IDS,
  MULTIPLE_PROPORTIONS_SCENE_VIEW,
  type MultipleProportionsModeId,
  WATER_PEROXIDE_MODE_ID,
} from "@repo/design-system/components/contents/chemistry/multiple-proportions-law/data";
import {
  MultipleProportionsScene,
  MultipleProportionsSceneColorsProvider,
} from "@repo/design-system/components/contents/chemistry/multiple-proportions-law/scene";
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
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";
import { useTranslations } from "use-intl";

const NARROW_CANVAS_ASPECT_RATIO = 1.24;

interface MultipleProportionsLabProps {
  description: ReactNode;
  labels: {
    changingLabel: string;
    chooseMode: string;
    comparisonView: string;
    fixedLabel: string;
    modes: Record<
      MultipleProportionsModeId,
      {
        changing: ReactNode;
        fixed: ReactNode;
        helperCaption: ReactNode;
        tab: ReactNode;
        tabLabel: string;
      }
    >;
  };
  title: ReactNode;
}

export function MultipleProportionsLab({
  title,
  description,
  labels,
}: MultipleProportionsLabProps) {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const [selectedModeId, setSelectedModeId] =
    useState<MultipleProportionsModeId>(WATER_PEROXIDE_MODE_ID);
  const selectedLabels = labels.modes[selectedModeId];
  const t = useTranslations("Common");
  const sceneColors = getAtomSceneColors(resolvedTheme);

  function handleModeChange(value: string) {
    if (!value) {
      return;
    }

    if (!isMultipleProportionsModeId(value)) {
      return;
    }

    setSelectedModeId(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseMode}
          gridColumns="3"
          onValueChange={handleModeChange}
          type="single"
          value={selectedModeId}
          variant="outline"
        >
          {Arr.map(MULTIPLE_PROPORTIONS_MODE_IDS, (modeId) => (
            <ToggleGroupItem
              aria-label={labels.modes[modeId].tabLabel}
              key={modeId}
              value={modeId}
            >
              {labels.modes[modeId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.comparisonView}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ThreeCanvas frameloop="always">
          <Suspense>
            <MultipleProportionsCameraControls />
            <ambientLight intensity={0.68} />
            <hemisphereLight
              color={sceneColors.text}
              groundColor={sceneColors.bond}
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
            <MultipleProportionsSceneColorsProvider colors={sceneColors}>
              <MultipleProportionsScene modeId={selectedModeId} />
            </MultipleProportionsSceneColorsProvider>
          </Suspense>
        </ThreeCanvas>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={t("note")} value={selectedLabels.helperCaption} />
          <VisualFact label={labels.fixedLabel} value={selectedLabels.fixed} />
          <VisualFact
            label={labels.changingLabel}
            value={selectedLabels.changing}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

function MultipleProportionsCameraControls() {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? MULTIPLE_PROPORTIONS_SCENE_VIEW.narrowCameraPosition
    : MULTIPLE_PROPORTIONS_SCENE_VIEW.cameraPosition;

  return (
    <CameraControls
      cameraPosition={cameraPosition}
      cameraTarget={MULTIPLE_PROPORTIONS_SCENE_VIEW.cameraTarget}
      fov={42}
      framing="content"
    />
  );
}

"use client";

import { useThree } from "@react-three/fiber";
import {
  GAS_CUE_ID,
  getReactionSceneColors,
  isReactionCueId,
  REACTION_CUE_IDS,
  REACTION_SCENE_VIEW,
  type ReactionCueId,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/data";
import { ReactionCharacteristicsScene } from "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/scene";
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
import { Array as Arr } from "effect";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

const NARROW_CANVAS_ASPECT_RATIO = 1.35;

export interface ReactionCharacteristicsLabProps {
  description: ReactNode;
  labels: {
    after: string;
    before: string;
    chooseCue: string;
    cues: Record<
      ReactionCueId,
      {
        helperCaption: ReactNode;
        limit: ReactNode;
        meaning: ReactNode;
        observation: ReactNode;
        tab: string;
      }
    >;
    limitLabel: string;
    meaningLabel: string;
    observationLabel: string;
    transition: string;
  };
  title: ReactNode;
}

/**
 * Renders a 3D lab for reading common signs of chemical reactions.
 */
export function ChemicalReactionCharacteristicsLab({
  title,
  description,
  labels,
}: ReactionCharacteristicsLabProps) {
  const { resolvedTheme } = useTheme();
  const [selectedCueId, setSelectedCueId] = useState<ReactionCueId>(GAS_CUE_ID);
  const selectedLabels = labels.cues[selectedCueId];
  const sceneColors = getReactionSceneColors(resolvedTheme);

  /**
   * Keeps one clue selected when ToggleGroup emits an empty value.
   */
  function handleCueChange(value: string) {
    if (!value) {
      return;
    }

    if (!isReactionCueId(value)) {
      return;
    }

    setSelectedCueId(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody className="flex flex-col gap-4">
        <ToggleGroup
          aria-label={labels.chooseCue}
          gridColumns="4"
          onValueChange={handleCueChange}
          type="single"
          value={selectedCueId}
          variant="outline"
        >
          {Arr.map(REACTION_CUE_IDS, (cueId) => (
            <ToggleGroupItem key={cueId} value={cueId}>
              {labels.cues[cueId].tab}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <VisualCardScene
          aria-label={labels.transition}
          className={threeSceneFrameVariants()}
          render={<section />}
        >
          <ThreeCanvas frameloop="always">
            <Suspense>
              <ReactionCameraControls />
              <ambientLight intensity={0.68} />
              <hemisphereLight
                color={sceneColors.skyLight}
                groundColor={sceneColors.groundLight}
                intensity={0.66}
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
              <ReactionCharacteristicsScene
                colors={sceneColors}
                cueId={selectedCueId}
                labels={labels}
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
          <ReactionFact
            label={labels.observationLabel}
            value={selectedLabels.observation}
          />
          <ReactionFact
            label={labels.meaningLabel}
            value={selectedLabels.meaning}
          />
          <ReactionFact
            label={labels.limitLabel}
            value={selectedLabels.limit}
          />
        </dl>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * Keeps the two beakers framed on narrow and wide canvases.
 */
function ReactionCameraControls() {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? REACTION_SCENE_VIEW.narrowCameraPosition
    : REACTION_SCENE_VIEW.cameraPosition;

  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={cameraPosition}
      cameraTarget={REACTION_SCENE_VIEW.cameraTarget}
      fov={45}
    />
  );
}

/**
 * Renders one compact explanation in the lab footer.
 */
function ReactionFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}

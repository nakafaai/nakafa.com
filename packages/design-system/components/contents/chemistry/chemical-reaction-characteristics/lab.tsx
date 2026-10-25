import { useThree } from "@react-three/fiber";
import {
  createReactionCueStore,
  ReactionCharacteristicsSceneProvider,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/context";
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
import { Suspense, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";

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
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const [store] = useState(() => createReactionCueStore(GAS_CUE_ID));
  const selectedCueId = useStore(store, (state) => state.cueId);
  const selectCue = useStore(store, (state) => state.selectCue);
  const selectedLabels = labels.cues[selectedCueId];
  const t = useTranslations("Common");
  const sceneColors = useMemo(
    () => getReactionSceneColors(resolvedTheme),
    [resolvedTheme]
  );

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

    selectCue(value);
  }

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
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
      </VisualCardToolbar>

      <VisualCardBody
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
            <ReactionCharacteristicsSceneProvider
              colors={sceneColors}
              store={store}
            >
              <ReactionCharacteristicsScene labels={labels} />
            </ReactionCharacteristicsSceneProvider>
          </Suspense>
        </ThreeCanvas>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={t("note")} value={selectedLabels.helperCaption} />
          <VisualFact
            label={labels.observationLabel}
            value={selectedLabels.observation}
          />
          <VisualFact
            label={labels.meaningLabel}
            value={selectedLabels.meaning}
          />
          <VisualFact label={labels.limitLabel} value={selectedLabels.limit} />
        </VisualCardFacts>
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
      cameraPosition={cameraPosition}
      cameraTarget={REACTION_SCENE_VIEW.cameraTarget}
      fov={45}
    />
  );
}

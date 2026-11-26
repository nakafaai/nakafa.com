import { useThree } from "@react-three/fiber";
import type { ConstantCompositionModeId } from "@repo/design-system/components/contents/chemistry/constant-composition-law/data";
import {
  CONSTANT_COMPOSITION_MODE_IDS,
  CONSTANT_COMPOSITION_SCENE_VIEW,
  EXACT_RATIO_MODE_ID,
  isConstantCompositionModeId,
} from "@repo/design-system/components/contents/chemistry/constant-composition-law/data";
import { ConstantCompositionScene } from "@repo/design-system/components/contents/chemistry/constant-composition-law/scene";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import {
  isNarrowThreeScene,
  threeSceneFrameVariants,
} from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";
import { useTranslations } from "use-intl";

const NARROW_CANVAS_ASPECT_RATIO = 1.28;

export interface ConstantCompositionLabProps {
  description: NonNullable<ReactNode>;
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
  title: NonNullable<ReactNode>;
}

export function ConstantCompositionLab({
  title,
  description,
  labels,
}: ConstantCompositionLabProps) {
  const [selectedModeId, setSelectedModeId] =
    useState<ConstantCompositionModeId>(EXACT_RATIO_MODE_ID);
  const selectedLabels = labels.modes[selectedModeId];
  const t = useTranslations("Common");

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
    <VisualCard onReset={() => setSelectedModeId(EXACT_RATIO_MODE_ID)}>
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
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.reactionView}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={1.05} setting="lab">
          <Suspense fallback={null}>
            <ConstantCompositionCameraControls />
            <ConstantCompositionScene labels={labels} modeId={selectedModeId} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={t("note")} value={selectedLabels.helperCaption} />
          <VisualFact label={labels.ratioLabel} value={selectedLabels.ratio} />
          <VisualFact
            label={labels.leftoverLabel}
            value={selectedLabels.leftover}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

function ConstantCompositionCameraControls() {
  const size = useThree((state) => state.size);
  const narrow = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO);

  return (
    <CameraControls
      cameraPosition={
        narrow
          ? CONSTANT_COMPOSITION_SCENE_VIEW.narrowCameraPosition
          : CONSTANT_COMPOSITION_SCENE_VIEW.cameraPosition
      }
      cameraTarget={CONSTANT_COMPOSITION_SCENE_VIEW.cameraTarget}
      fov={38}
      maxDistance={1.65}
      minDistance={0.35}
    />
  );
}

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
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";
import { useTranslations } from "use-intl";

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
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const [selectedModeId, setSelectedModeId] = useState<MassConservationModeId>(
    CLOSED_SYSTEM_MODE_ID
  );
  const selectedLabels = labels.modes[selectedModeId];
  const t = useTranslations("Common");
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

      <VisualCardToolbar>
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
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.reactionView}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage frameloop="always" setting="lab">
          <Suspense>
            <MassConservationCameraControls />
            <MassConservationScene
              colors={sceneColors}
              labels={labels}
              modeId={selectedModeId}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact label={t("note")} value={selectedLabels.helperCaption} />
          <VisualFact
            label={labels.systemLabel}
            value={selectedLabels.system}
          />
          <VisualFact
            label={labels.calculationLabel}
            value={selectedLabels.calculation}
          />
        </VisualCardFacts>
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
      cameraPosition={cameraPosition}
      cameraTarget={MASS_CONSERVATION_SCENE_VIEW.cameraTarget}
      fov={42}
    />
  );
}

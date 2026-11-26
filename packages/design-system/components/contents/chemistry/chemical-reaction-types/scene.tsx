import { useChemicalReactionTypeScene } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/context";
import type { ChemicalReactionTypeSceneLabelsSchema } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import {
  ReactionModel,
  ReactionPhaseContext,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/models";
import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { getColor } from "@repo/design-system/lib/color";

const BEFORE_X = -1.24;
const AFTER_X = 1.24;
const SCENE_SCALE = 1.22;

export function ChemicalReactionTypesScene({
  labels,
}: {
  labels: typeof ChemicalReactionTypeSceneLabelsSchema.Type;
}) {
  const { colors } = useChemicalReactionTypeScene();

  return (
    <group position={[0, -0.08, 0]} scale={SCENE_SCALE}>
      <CameraBounds exclude>
        <SeamlessBenchSurface radius={22} y={-0.58} />
      </CameraBounds>
      <ThreeLabel
        anchorY="bottom"
        color={colors.text}
        fontSize="compact"
        position={[BEFORE_X, 0.92, 0]}
      >
        {labels.before}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={colors.text}
        fontSize="compact"
        position={[AFTER_X, 0.92, 0]}
      >
        {labels.after}
      </ThreeLabel>
      <group position={[BEFORE_X, 0, 0]}>
        <ReactionPhaseContext value="before">
          <ReactionModel />
        </ReactionPhaseContext>
      </group>

      <ArrowHelper
        arrowSize={0.22}
        color={getColor("WHITE")}
        from={[-0.36, 0, 0]}
        lineWidth={3}
        to={[0.36, 0, 0]}
      />

      <group position={[AFTER_X, 0, 0]}>
        <ReactionPhaseContext value="after">
          <ReactionModel />
        </ReactionPhaseContext>
      </group>
    </group>
  );
}

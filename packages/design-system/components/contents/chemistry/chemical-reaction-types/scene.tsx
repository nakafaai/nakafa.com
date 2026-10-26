import { useChemicalReactionTypeScene } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/context";
import type { ChemicalReactionTypeSceneLabelsSchema } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import {
  ReactionModel,
  ReactionPhaseContext,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/models";
import { ThreeLabel } from "@repo/design-system/components/three/label";

const BEFORE_X = -1.18;
const AFTER_X = 1.18;
const SCENE_SCALE = 1.28;

export function ChemicalReactionTypesScene({
  labels,
}: {
  labels: typeof ChemicalReactionTypeSceneLabelsSchema.Type;
}) {
  const { colors } = useChemicalReactionTypeScene();

  return (
    <group position={[0, -0.08, 0]} scale={SCENE_SCALE}>
      <ThreeLabel
        color={colors.text}
        fontSize="compact"
        position={[BEFORE_X, 0.74, 0.16]}
      >
        {labels.before}
      </ThreeLabel>
      <ThreeLabel
        color={colors.text}
        fontSize="compact"
        position={[AFTER_X, 0.74, 0.16]}
      >
        {labels.after}
      </ThreeLabel>
      <group position={[BEFORE_X, 0, 0]}>
        <ReactionPhaseContext value="before">
          <ReactionModel />
        </ReactionPhaseContext>
      </group>

      <group position={[AFTER_X, 0, 0]}>
        <ReactionPhaseContext value="after">
          <ReactionModel />
        </ReactionPhaseContext>
      </group>
    </group>
  );
}

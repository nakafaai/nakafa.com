import {
  useChemicalReactionTypeScene,
  useChemicalReactionTypeSelection,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/context";
import type { ChemicalReactionTypeSceneLabelsSchema } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import {
  COMBUSTION_TYPE_ID,
  RUST_TYPE_ID,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import {
  ReactionModel,
  ReactionPhaseContext,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/models";
import { SpecimenPlinth } from "@repo/design-system/components/contents/chemistry/specimen";
import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";

const BEFORE_X = -1.24;
const AFTER_X = 1.24;
const SCENE_SCALE = 1.22;

/** The bench under the models, and the top of the display plinth each model stands on. */
const BENCH_Y = -0.58;
const PLINTH_TOP = -0.5;

/** How much larger than its real size a display plinth is drawn in this scene's units. */
const PLINTH_SCALE = 3.2;

/** How high the post of a display stand reaches under a model of particles or a metal plate. */
const POST_TOP = { particles: -0.16, plate: -0.1 } as const;

export function ChemicalReactionTypesScene({
  labels,
}: {
  labels: typeof ChemicalReactionTypeSceneLabelsSchema.Type;
}) {
  const { colors } = useChemicalReactionTypeScene();

  return (
    <group position={[0, -0.08, 0]} scale={SCENE_SCALE}>
      <CameraBounds exclude>
        <SeamlessBenchSurface radius={22} y={BENCH_Y} />
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
        <DisplayStand />
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
        <DisplayStand />
        <ReactionPhaseContext value="after">
          <ReactionModel />
        </ReactionPhaseContext>
      </group>
    </group>
  );
}

/**
 * The display stand under one side of the reaction: an anodised plinth on
 * the bench, and for a model of particles or a metal plate a chrome post
 * with a cradle that holds the model up, as a museum mounts a molecular
 * model. A beaker stands on the plinth itself.
 */
function DisplayStand() {
  const typeId = useChemicalReactionTypeSelection((state) => state.typeId);
  const post = postTop(typeId);
  return (
    <group>
      <group position={[0, BENCH_Y, 0]} scale={PLINTH_SCALE}>
        <SpecimenPlinth depth={0.3} height={0.011} width={0.36} />
      </group>
      {post === null ? null : (
        <group>
          <mesh castShadow position={[0, PLINTH_TOP + 0.012, 0]}>
            <cylinderGeometry args={[0.09, 0.1, 0.024, 48]} />
            <MetalMaterial color={BENCH_COLORS.standChrome} roughness={0.24} />
          </mesh>
          <mesh castShadow position={[0, (PLINTH_TOP + post) / 2, 0]}>
            <cylinderGeometry args={[0.016, 0.016, post - PLINTH_TOP, 24]} />
            <MetalMaterial color={BENCH_COLORS.standChrome} roughness={0.2} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** How high a display stand's post reaches for a reaction type, or null when its model stands on the plinth. */
function postTop(typeId: string) {
  if (typeId === COMBUSTION_TYPE_ID) {
    return POST_TOP.particles;
  }
  return typeId === RUST_TYPE_ID ? POST_TOP.plate : null;
}

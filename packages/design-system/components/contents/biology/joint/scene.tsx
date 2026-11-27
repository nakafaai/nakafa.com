import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  JointKind,
  JointPart,
} from "@repo/design-system/components/contents/biology/joint/model";
import { jointAnglesAt } from "@repo/design-system/components/contents/biology/joint/model";
import {
  ballForms,
  discForms,
  ELBOW_INSERTION,
  forearmForms,
  humerusForms,
  SHOULDER_INSERTION,
  scapulaForms,
  seamForms,
  vaultForms,
  vertebraForms,
} from "@repo/design-system/components/contents/biology/joint/skeleton";
import {
  bulge,
  stretchBetween,
} from "@repo/design-system/components/contents/biology/joint/strap";
import type { Synovial } from "@repo/design-system/components/contents/biology/joint/tissue";
import {
  bellyForms,
  capsuleForms,
  collateralForms,
  fixedCartilage,
  fluidForms,
  headCartilage,
  tendonForms,
} from "@repo/design-system/components/contents/biology/joint/tissue";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Body } from "@repo/design-system/components/three/organism/body";
import { Skin } from "@repo/design-system/components/three/organism/skin";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { useRef } from "react";
import type { Group } from "three";
import { Vector3 } from "three";

/** The soft parts of each synovial joint, built once so every body keeps its shape between renders. */
const SOFT = {
  ballSocket: {
    capsule: capsuleForms("ballSocket"),
    cartilage: fixedCartilage("ballSocket"),
    fluid: fluidForms("ballSocket"),
  },
  hinge: {
    capsule: capsuleForms("hinge"),
    cartilage: fixedCartilage("hinge"),
    fluid: fluidForms("hinge"),
  },
};

/**
 * The muscle that moves each synovial joint: where it starts on the bone
 * that stays still, where its tendon grips the bone that moves (in that
 * bone's own frame), the place its tendon heads for, its tendon's length,
 * and its belly's thickness at its resting length.
 */
const MUSCLE: Record<
  Synovial,
  {
    readonly girth: number;
    readonly grip: Vector3;
    readonly origin: Vector3;
    readonly rest: number;
    readonly tendon: number;
    readonly towards: Vector3;
  }
> = {
  ballSocket: {
    girth: 0.058,
    grip: new Vector3(...SHOULDER_INSERTION),
    origin: new Vector3(-0.64, 0.21, -0.02),
    rest: 0.6,
    tendon: 0.22,
    towards: new Vector3(-0.3, 0.33, 0),
  },
  hinge: {
    girth: 0.062,
    grip: new Vector3(...ELBOW_INSERTION),
    origin: new Vector3(-0.64, 0.145, 0.03),
    rest: 0.67,
    tendon: 0.22,
    towards: new Vector3(-0.3, 0.22, 0.05),
  },
};

/** How thick a tendon is drawn. */
const CORD = 0.014;

/** The two places a frame works out for a muscle, reused so a frame allocates nothing. */
const grip = new Vector3();
const junction = new Vector3();

/** Living compact bone: matt, faintly pitted, and warm where light passes through its thin edges. */
function BoneSkin() {
  return (
    <Skin
      bump={0.22}
      flesh={SKELETON_COLORS.boneSoft}
      glow={0.25}
      repeat={[5, 3]}
      roughness={0.8}
      surface="stone"
    />
  );
}

/** Hyaline cartilage: smooth, wet and pearly. */
function CartilageSkin() {
  return (
    <Skin
      bump={0.15}
      flesh={SKELETON_COLORS.cartilageHyaline}
      glow={0.5}
      repeat={[2, 2]}
      roughness={0.35}
      surface="ceramic"
      wet={0.9}
    />
  );
}

/** A tendon, a ligament or a capsule: tough, moist cords of fibre with a silky sheen. */
function CordSkin() {
  return (
    <Skin
      bump={0.5}
      flesh={SKELETON_COLORS.tendonSheen}
      glow={0.4}
      repeat={[1, 3]}
      roughness={0.6}
      surface="wood"
      wet={0.35}
    />
  );
}

/** Skeletal muscle under its thin wet sheath. */
function MuscleSkin() {
  return (
    <Skin
      bump={0.5}
      flesh={SKELETON_COLORS.muscleFiber}
      glow={0.4}
      repeat={[2, 4]}
      roughness={0.55}
      surface="tissue"
      wet={0.6}
    />
  );
}

/** The synovial membrane and the fibrous capsule round it: soft, wet and finely folded. */
function CapsuleSkin() {
  return (
    <Skin
      bump={0.45}
      flesh={SKELETON_COLORS.synovium}
      glow={0.4}
      repeat={[4, 4]}
      roughness={0.5}
      surface="mucosa"
      wet={0.7}
    />
  );
}

/** Synovial fluid: a clear, slippery, straw-coloured film. */
function FluidSkin() {
  return (
    <Skin
      bump={0.1}
      clear={0.55}
      repeat={[1, 1]}
      roughness={0.08}
      surface="plastic"
      wet={1}
    />
  );
}

/** The camera every joint is seen with: one authored pose, fitted to what the joint can reach. */
function JointCamera() {
  return (
    <CameraControls
      cameraPosition={[0.5, 0.7, 4]}
      cameraTarget={[0, 0, 0]}
      fov={30}
      framing="content"
      maxDistance={6.8}
      minDistance={0.8}
    />
  );
}

/**
 * One joint of the human skeleton as an anatomical specimen: a suture of
 * the skull, two vertebrae and their disc, the elbow or the shoulder. The
 * bone that can move follows the learner's slider, or swings by itself while
 * the card plays, and the muscle that moves it shortens and thickens.
 *
 * @param joint - Which joint is shown
 * @param motion - How far the moving bone has moved, from 0 to 1
 * @param onMotionChange - Reports the motion while the card plays
 * @param parts - The names of the parts
 */
export function JointScene({
  joint,
  motion,
  onMotionChange,
  parts,
}: {
  readonly joint: JointKind;
  readonly motion: number;
  readonly onMotionChange: (next: number) => void;
  readonly parts: Readonly<Record<JointPart, string>>;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const moving = useRef<Group>(null);
  const pad = useRef<Group>(null);
  const tendon = useRef<Group>(null);
  const belly = useRef<Group>(null);
  const clock = useRef(0);

  useFrame((_, delta) => {
    let current = motion;
    if (playing) {
      clock.current += simulationStep(delta);
      current = 0.5 + 0.5 * Math.sin(clock.current * 1.8);
      if (Math.abs(current - motion) > 0.04) {
        onMotionChange(Math.round(current * 100) / 100);
      }
    }
    const angles = jointAnglesAt(joint, current);
    moving.current?.rotation.set(
      angles.pitchRad,
      angles.yawRad,
      angles.rollRad
    );
    // A disc gives half the way its upper vertebra tilts, so it stays joined to both.
    pad.current?.rotation.set(angles.pitchRad / 2, 0, angles.rollRad / 2);
    if (
      moving.current === null ||
      tendon.current === null ||
      belly.current === null ||
      joint === "suture" ||
      joint === "disc"
    ) {
      return;
    }
    const muscle = MUSCLE[joint];
    grip.copy(muscle.grip).applyEuler(moving.current.rotation);
    junction
      .subVectors(muscle.towards, grip)
      .setLength(muscle.tendon)
      .add(grip);
    stretchBetween(tendon.current, grip, junction, CORD);
    stretchBetween(
      belly.current,
      muscle.origin,
      junction,
      bulge(muscle.girth, muscle.rest, muscle.origin.distanceTo(junction))
    );
  });

  if (joint === "suture") {
    return (
      <group>
        <SimulationTicker running={playing} />
        <JointCamera />
        <group rotation={[-0.32, 0.3, 0.1]}>
          <group position={[0, 0, -1.2]}>
            <Body shape={vaultForms}>
              <BoneSkin />
            </Body>
            <Body shape={seamForms}>
              <CordSkin />
            </Body>
          </group>
          <ThreeLabel
            anchorY="bottom"
            color={ink}
            fontSize="compact"
            gap={0.05}
            position={[-0.3, 0.5, -0.1]}
          >
            {parts.bone}
          </ThreeLabel>
          <ThreeLabel
            anchorY="top"
            color={ink}
            fontSize="compact"
            gap={0.05}
            position={[0, -0.49, -0.08]}
          >
            {parts.ligament}
          </ThreeLabel>
        </group>
      </group>
    );
  }

  if (joint === "disc") {
    return (
      <group>
        <SimulationTicker running={playing} />
        <JointCamera />
        <group rotation={[0.12, 0.65, 0]}>
          <group position={[0, -0.165, 0]}>
            <Body shape={vertebraForms}>
              <BoneSkin />
            </Body>
          </group>
          <group ref={pad}>
            <Body shape={discForms}>
              <CordSkin />
            </Body>
          </group>
          <CameraBounds motion={{ rotation: "x" }} objectRef={moving}>
            <group position={[0, 0.165, 0]}>
              <Body shape={vertebraForms}>
                <BoneSkin />
              </Body>
            </group>
          </CameraBounds>
        </group>
        <ThreeLabel
          anchorX="right"
          color={ink}
          fontSize="compact"
          gap={0.06}
          position={[-0.3, 0.22, 0.1]}
        >
          {parts.bone}
        </ThreeLabel>
        <ThreeLabel
          anchorX="left"
          color={ink}
          fontSize="compact"
          gap={0.06}
          position={[0.3, 0, 0.1]}
        >
          {parts.cartilage}
        </ThreeLabel>
      </group>
    );
  }

  const hinge = joint === "hinge";
  const soft = SOFT[joint];

  return (
    <group>
      <SimulationTicker running={playing} />
      <JointCamera />
      <Body shape={hinge ? humerusForms : scapulaForms}>
        <BoneSkin />
      </Body>
      <Body shape={soft.cartilage}>
        <CartilageSkin />
      </Body>
      <Body shape={soft.capsule}>
        <CapsuleSkin />
      </Body>
      <Body cast={false} shape={soft.fluid}>
        <FluidSkin />
      </Body>
      <CameraBounds
        motion={{ rotation: hinge ? "z" : "all" }}
        objectRef={moving}
      >
        <Body shape={hinge ? forearmForms : ballForms}>
          <BoneSkin />
        </Body>
        {hinge ? (
          <Body shape={collateralForms}>
            <CordSkin />
          </Body>
        ) : (
          <Body shape={headCartilage}>
            <CartilageSkin />
          </Body>
        )}
      </CameraBounds>
      <group ref={tendon}>
        <Body shape={tendonForms}>
          <CordSkin />
        </Body>
      </group>
      <group ref={belly}>
        <Body shape={bellyForms}>
          <MuscleSkin />
        </Body>
      </group>

      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={[-0.45, hinge ? 0.24 : 0.3, 0]}
      >
        {parts.muscle}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={[-0.08, hinge ? 0.3 : 0.36, 0.05]}
      >
        {parts.tendon}
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        anchorY="top"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={[-0.5, -0.08, 0]}
      >
        {parts.bone}
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={[hinge ? 0 : -0.1, hinge ? -0.24 : -0.16, 0.12]}
      >
        {parts.cartilage}
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={[-0.32, -0.3, 0]}
      >
        {parts.ligament}
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        anchorY="top"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={[0.2, -0.26, -0.1]}
      >
        {parts.membrane}
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        anchorY="top"
        color={ink}
        fontSize="compact"
        gap={0.05}
        position={[0.36, -0.42, -0.1]}
      >
        {parts.fluid}
      </ThreeLabel>
    </group>
  );
}

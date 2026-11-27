import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { Callout } from "@repo/design-system/components/contents/biology/joint/callout";
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
  BoneSkin,
  CapsuleSkin,
  CartilageSkin,
  CordSkin,
  FluidSkin,
  MuscleSkin,
} from "@repo/design-system/components/contents/biology/joint/skins";
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
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { Array as Arr } from "effect";
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
    origin: new Vector3(-0.54, 0.17, -0.02),
    rest: 0.5,
    tendon: 0.22,
    towards: new Vector3(-0.3, 0.33, 0),
  },
  hinge: {
    girth: 0.062,
    grip: new Vector3(...ELBOW_INSERTION),
    origin: new Vector3(-0.52, 0.115, 0.03),
    rest: 0.55,
    tendon: 0.22,
    towards: new Vector3(-0.3, 0.22, 0.05),
  },
};

/** The parts of a synovial joint that stay still, whose names stand in open space on leaders. */
const STILL = [
  "muscle",
  "bone",
  "cartilage",
  "ligament",
  "membrane",
  "fluid",
] as const;

/** Where each still part's name stands, the edge its leader leaves from, and the point it names. */
const NAMES: Record<
  Synovial,
  Readonly<
    Record<
      (typeof STILL)[number],
      {
        readonly at: readonly [number, number, number];
        readonly side: "bottom" | "left" | "right" | "top";
        readonly target: readonly [number, number, number];
      }
    >
  >
> = {
  ballSocket: {
    bone: { at: [-0.62, -0.08, 0], side: "right", target: [-0.54, -0.08, 0] },
    cartilage: {
      at: [-0.4, -0.34, 0.06],
      side: "top",
      target: [-0.077, -0.084, 0.065],
    },
    fluid: {
      at: [0.42, -0.46, -0.1],
      side: "top",
      target: [-0.046, -0.13, -0.099],
    },
    ligament: {
      at: [-0.2, -0.46, 0.06],
      side: "top",
      target: [-0.175, -0.107, 0.064],
    },
    membrane: {
      at: [0.14, -0.34, -0.1],
      side: "top",
      target: [-0.052, -0.106, -0.142],
    },
    muscle: {
      at: [-0.62, 0.17, -0.02],
      side: "right",
      target: [-0.54, 0.17, -0.02],
    },
  },
  hinge: {
    bone: { at: [-0.6, 0, 0], side: "right", target: [-0.52, 0, 0] },
    cartilage: {
      at: [-0.36, -0.3, 0.1],
      side: "top",
      target: [-0.03, -0.07, 0.105],
    },
    fluid: {
      at: [0.44, -0.42, -0.1],
      side: "top",
      target: [0.045, -0.109, -0.122],
    },
    ligament: {
      at: [-0.14, -0.42, 0.14],
      side: "top",
      target: [0, -0.02, 0.146],
    },
    membrane: {
      at: [0.2, -0.3, -0.1],
      side: "top",
      target: [0.108, -0.141, -0.091],
    },
    muscle: {
      at: [-0.6, 0.115, 0.03],
      side: "right",
      target: [-0.52, 0.115, 0.03],
    },
  },
};

/**
 * How many scene units one unit of a joint's anatomy is drawn at, so the
 * specimen fills the frame beside names of the stage's own reading size.
 */
const SCALE = 3.5;

/** How thick a tendon is drawn. */
const CORD = 0.019;

/** The two places a frame works out for a muscle, reused so a frame allocates nothing. */
const grip = new Vector3();
const junction = new Vector3();

/** How far the camera stands from each joint, so the joint and all it can reach fill the frame. */
const DISTANCE: Record<JointKind, number> = {
  ballSocket: 8.4,
  disc: 6.3,
  hinge: 8.4,
  suture: 8.4,
};

/** The camera a joint is seen with: one authored pose, fitted to what the joint can reach. */
function JointCamera({ distance }: { readonly distance: number }) {
  return (
    <CameraControls
      cameraPosition={[0.12 * distance, 0.17 * distance, 0.98 * distance]}
      cameraTarget={[0, 0, 0]}
      fov={30}
      framing="content"
      maxDistance={24}
      minDistance={2.8}
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
  const mark = useRef<Group>(null);
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
      mark.current === null ||
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
    mark.current.position.copy(junction).multiplyScalar(SCALE);
  });

  if (joint === "suture") {
    return (
      <group>
        <SimulationTicker running={playing} />
        <JointCamera distance={DISTANCE[joint]} />
        <group rotation={[-0.5, 0.42, 0.12]}>
          <group position={[0, 0, -1.2 * SCALE]} scale={SCALE}>
            <Body shape={vaultForms}>
              <BoneSkin />
            </Body>
            <Body shape={seamForms}>
              <CordSkin />
            </Body>
          </group>
          <Callout
            at={[-0.4, 0.4, 0]}
            scale={SCALE}
            side="bottom"
            target={[-0.36, 0.26, -0.06]}
          >
            {parts.bone}
          </Callout>
          <Callout
            at={[0.1, -0.4, 0]}
            scale={SCALE}
            side="top"
            target={[0, -0.28, 0]}
          >
            {parts.ligament}
          </Callout>
        </group>
      </group>
    );
  }

  if (joint === "disc") {
    return (
      <group>
        <SimulationTicker running={playing} />
        <JointCamera distance={DISTANCE[joint]} />
        <group rotation={[0.12, 0.65, 0]}>
          <group scale={SCALE}>
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
            <group ref={moving}>
              <group position={[0, 0.165, 0]}>
                <Body shape={vertebraForms}>
                  <BoneSkin />
                </Body>
              </group>
            </group>
          </group>
          <Callout
            at={[-0.26, 0.36, 0.2]}
            scale={SCALE}
            side="bottom"
            target={[-0.12, 0.2, 0.13]}
          >
            {parts.bone}
          </Callout>
          <Callout
            at={[0.3, -0.36, 0.2]}
            scale={SCALE}
            side="top"
            target={[0.1, -0.02, 0.15]}
          >
            {parts.cartilage}
          </Callout>
        </group>
      </group>
    );
  }

  const hinge = joint === "hinge";
  const soft = SOFT[joint];
  const names = NAMES[joint];

  return (
    <group>
      <SimulationTicker running={playing} />
      <JointCamera distance={DISTANCE[joint]} />
      <group scale={SCALE}>
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
        <CameraBounds exclude objectRef={tendon}>
          <Body shape={tendonForms}>
            <CordSkin />
          </Body>
        </CameraBounds>
        <CameraBounds exclude objectRef={belly}>
          <Body shape={bellyForms}>
            <MuscleSkin />
          </Body>
        </CameraBounds>
      </group>
      <group ref={mark}>
        <ThreeLabel
          anchorX="right"
          anchorY="bottom"
          color={ink}
          fontSize="compact"
          gap={0.1}
          position={[-0.07, 0.25, 0]}
        >
          {parts.tendon}
        </ThreeLabel>
      </group>
      {Arr.map(STILL, (part) => (
        <Callout
          at={names[part].at}
          key={part}
          scale={SCALE}
          side={names[part].side}
          target={names[part].target}
        >
          {parts[part]}
        </Callout>
      ))}
    </group>
  );
}

import type { JointKind } from "@repo/design-system/components/contents/biology/joint/model";
import {
  ELBOW_INSERTION,
  SHOULDER_INSERTION,
} from "@repo/design-system/components/contents/biology/joint/skeleton";
import type { Synovial } from "@repo/design-system/components/contents/biology/joint/tissue";
import { Vector3 } from "three";

/**
 * The muscle that moves each synovial joint: where it starts on the bone
 * that stays still, where its tendon grips the bone that moves (in that
 * bone's own frame), the place its tendon heads for, its tendon's length,
 * and its belly's thickness at its resting length.
 */
export const MUSCLE: Record<
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
export const STILL = [
  "muscle",
  "bone",
  "cartilage",
  "ligament",
  "membrane",
  "fluid",
] as const;

/** Where each still part's name stands, the edge its leader leaves from, and the point it names. */
export const NAMES: Record<
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
      at: [-0.5, -0.34, 0.06],
      side: "top",
      target: [-0.077, -0.084, 0.065],
    },
    fluid: {
      at: [0.52, -0.46, -0.1],
      side: "top",
      target: [-0.046, -0.13, -0.099],
    },
    ligament: {
      at: [-0.16, -0.46, 0.06],
      side: "top",
      target: [-0.175, -0.107, 0.064],
    },
    membrane: {
      at: [0.28, -0.34, -0.1],
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
      at: [-0.48, -0.3, 0.1],
      side: "top",
      target: [-0.03, -0.07, 0.105],
    },
    fluid: {
      at: [0.52, -0.42, -0.1],
      side: "top",
      target: [0.045, -0.109, -0.122],
    },
    ligament: {
      at: [-0.14, -0.42, 0.14],
      side: "top",
      target: [0, -0.02, 0.146],
    },
    membrane: {
      at: [0.3, -0.3, -0.1],
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
export const SCALE = 3.5;

/** How thick a tendon is drawn. */
export const CORD = 0.019;

/** How far the camera stands from each joint, so the joint and all it can reach fill the frame. */
export const DISTANCE: Record<JointKind, number> = {
  ballSocket: 8.4,
  disc: 6.3,
  hinge: 8.4,
  suture: 8.4,
};

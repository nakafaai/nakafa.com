import { useFrame } from "@react-three/fiber";
import {
  DOOR,
  Doorway,
  HANDLE,
  Leaf,
} from "@repo/design-system/components/contents/physics/vector/door/leaf";
import {
  pushVectors,
  swingPeriod,
} from "@repo/design-system/components/contents/physics/vector/door/push";
import type { DoorSchema } from "@repo/design-system/components/contents/physics/vector/door/swing";
import {
  doorTorque,
  swingAngle,
} from "@repo/design-system/components/contents/physics/vector/door/swing";
import { FixedArrow } from "@repo/design-system/components/contents/physics/vector/solid/arrow";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import type { CoordinateTuple } from "@repo/design-system/components/three/frame";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { useRef } from "react";
import type { Group } from "three";

/** The length the push is drawn at, in metres; its part square to the door keeps its proportion. */
const PUSH = 0.55;

/** The length of the torque's arrow for the strongest torque the push can give, in metres. */
const TORQUE = 0.6;

/** How far in front of the door's face the arrows lie, so none sinks into the wood. */
const FRONT = DOOR.thick / 2 + 0.02;

/** One vector with its symbol where `label` puts it. */
function Vector({
  color,
  from,
  label,
  math,
  vector,
}: {
  readonly color: string;
  readonly from: CoordinateTuple;
  readonly label: CoordinateTuple;
  readonly math: string;
  readonly vector: CoordinateTuple;
}) {
  return (
    <group>
      <FixedArrow
        color={color}
        from={from}
        head={0.08}
        thickness={0.011}
        vector={vector}
      />
      <ThreeLabel color={color} fontSize="reading" position={label}>
        <InlineMath math={math} />
      </ThreeLabel>
    </group>
  );
}

/**
 * The door in its wall, pushed open by a hand at handle height: the arm
 * from the hinge line to the hand (slate), the push arriving at the hand
 * (amber), its part square to the door (teal), and the torque along the
 * hinge line (violet), which points down into the floor because the door
 * turns clockwise seen from above. The arrows ride on the door as it swings
 * open under the push, rests, and is pushed again.
 */
export function DoorScene({
  angle,
  arm,
  door,
}: {
  readonly angle: number;
  readonly arm: number;
  readonly door: typeof DoorSchema.Type;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const leaf = useRef<Group>(null);
  const time = useRef(0);
  const push = doorTorque(door, arm, angle);
  const drawn = pushVectors(arm, angle, PUSH);
  const torque = (TORQUE * push.torque) / (door.force * door.width);

  useVisualStop(() => {
    time.current = 0;
    leaf.current?.rotation.set(0, 0, 0);
  });
  useFrame((_, delta) => {
    if (!(playing && leaf.current)) {
      return;
    }
    time.current += simulationStep(delta);
    if (time.current > swingPeriod(push.spin)) {
      time.current = 0;
    }
    leaf.current.rotation.y =
      (swingAngle(push.spin, time.current) * Math.PI) / 180;
  });

  return (
    <group>
      <CameraBounds exclude>
        <Doorway width={door.width} />
      </CameraBounds>
      <group ref={leaf}>
        <Leaf width={door.width} />
        <Vector
          color={PLOT_COLORS.slate}
          from={[0, HANDLE.height + 0.18, FRONT]}
          label={[arm / 4, HANDLE.height + 0.32, FRONT]}
          math="\vec r"
          vector={[drawn.hand[0], 0, 0]}
        />
        <Vector
          color={PLOT_COLORS.amber}
          from={[
            drawn.hand[0] - drawn.force[0],
            HANDLE.height + 0.18,
            FRONT - drawn.force[1],
          ]}
          label={[
            drawn.hand[0] - drawn.force[0] * 0.6,
            HANDLE.height + 0.36,
            FRONT - drawn.force[1] * 0.6,
          ]}
          math="\vec F"
          vector={[drawn.force[0], 0, drawn.force[1]]}
        />
        <Vector
          color={PLOT_COLORS.teal}
          from={[drawn.hand[0], HANDLE.height + 0.1, FRONT - drawn.square[1]]}
          label={[
            drawn.hand[0] + 0.2,
            HANDLE.height - 0.14,
            FRONT - drawn.square[1] * 0.45,
          ]}
          math="F\sin\theta"
          vector={[0, 0, drawn.square[1]]}
        />
      </group>
      <Vector
        color={PLOT_COLORS.violet}
        from={[-0.12, DOOR.height - 0.25, 0.2]}
        label={[-0.26, DOOR.height - 0.25 - torque / 2, 0.2]}
        math="\vec\tau"
        vector={[0, -torque, 0]}
      />
    </group>
  );
}

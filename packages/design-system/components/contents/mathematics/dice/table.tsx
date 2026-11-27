import { RoundedBox } from "@react-three/drei";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { TRAY } from "@repo/design-system/components/contents/mathematics/dice/pose";
import {
  CHIP,
  chipPlacements,
  NUMBER_Z,
  RACK,
  rackWidth,
  stackX,
} from "@repo/design-system/components/contents/mathematics/dice/stack";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { DICE_COLORS } from "@repo/design-system/lib/material/dice";
import { Array as Arr } from "effect";
import type { Ref } from "react";
import { useImperativeHandle, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { Color, Matrix4, Quaternion, Vector2, Vector3 } from "three";

/** The outer size of the tray, wall to wall, in metres. */
const OUTER = {
  length: TRAY.length + 2 * TRAY.wall,
  width: TRAY.width + 2 * TRAY.wall,
} as const;

/** The top of the walls above the table, in metres. */
const RIM = TRAY.floor + TRAY.height;

/** How thick the felt lining of the walls is, in metres. */
const LINING = 0.0015;

/** Oiled walnut: its grain under a satin finish that keeps the wood's sheen. */
function Walnut() {
  return <Matter of="walnut" />;
}

/**
 * A walnut dice tray, 224 mm by 164 mm outside, its floor and the inside of
 * its walls lined with felt, standing on the table with its middle at the
 * origin. The felt's top is the floor dice land on.
 */
export function Tray() {
  const walls = [
    {
      key: "back",
      position: [0, RIM / 2, -(TRAY.width + TRAY.wall) / 2],
      size: [OUTER.length, RIM, TRAY.wall],
    },
    {
      key: "front",
      position: [0, RIM / 2, (TRAY.width + TRAY.wall) / 2],
      size: [OUTER.length, RIM, TRAY.wall],
    },
    {
      key: "left",
      position: [-(TRAY.length + TRAY.wall) / 2, RIM / 2, 0],
      size: [TRAY.wall, RIM, TRAY.width],
    },
    {
      key: "right",
      position: [(TRAY.length + TRAY.wall) / 2, RIM / 2, 0],
      size: [TRAY.wall, RIM, TRAY.width],
    },
  ] as const;
  const lined = RIM - TRAY.floor - 0.004;
  const linings = [
    {
      key: "back",
      position: [0, 0, -(TRAY.width - LINING) / 2],
      size: [TRAY.length, lined, LINING],
    },
    {
      key: "front",
      position: [0, 0, (TRAY.width - LINING) / 2],
      size: [TRAY.length, lined, LINING],
    },
    {
      key: "left",
      position: [-(TRAY.length - LINING) / 2, 0, 0],
      size: [LINING, lined, TRAY.width],
    },
    {
      key: "right",
      position: [(TRAY.length - LINING) / 2, 0, 0],
      size: [LINING, lined, TRAY.width],
    },
  ] as const;
  return (
    <group>
      <mesh castShadow position={[0, TRAY.floor / 2, 0]} receiveShadow>
        <boxGeometry args={[OUTER.length, TRAY.floor, OUTER.width]} />
        <Walnut />
      </mesh>
      <mesh position={[0, TRAY.floor + 0.0005, 0]} receiveShadow>
        <boxGeometry args={[TRAY.length, 0.001, TRAY.width]} />
        <Matter color={DICE_COLORS.felt} of="felt" />
      </mesh>
      {Arr.map(walls, (wall) => (
        <RoundedBox
          args={[wall.size[0], wall.size[1], wall.size[2]]}
          castShadow
          key={wall.key}
          position={wall.position}
          radius={0.003}
          receiveShadow
          smoothness={3}
        >
          <Walnut />
        </RoundedBox>
      ))}
      {Arr.map(linings, (lining) => (
        <mesh
          key={lining.key}
          position={[
            lining.position[0],
            TRAY.floor + lined / 2,
            lining.position[2],
          ]}
          receiveShadow
        >
          <boxGeometry args={lining.size} />
          <Matter color={DICE_COLORS.feltShade} of="felt" />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The oak riser behind the tray, with each outcome's number on its front
 * half: the target's number, if there is one, in its highlight colour, the
 * others in the card's ink.
 */
export function Rack({
  highlight,
  outcomes,
  target,
}: {
  readonly highlight: string;
  readonly outcomes: readonly number[];
  readonly target: number | undefined;
}) {
  const ink = useLabelInk();
  // Two-digit sums stand too close for one row on a phone, so every other
  // number hangs just under the rack's front edge instead of over it.
  const crowded = outcomes.length > 6;
  return (
    <group>
      <RoundedBox
        args={[rackWidth(outcomes.length), RACK.height, RACK.depth]}
        castShadow
        position={[0, RACK.height / 2, RACK.z]}
        radius={0.003}
        receiveShadow
        smoothness={3}
      >
        <Matter of="oak" />
      </RoundedBox>
      {Arr.map(outcomes, (outcome, index) => (
        <ThreeLabel
          anchorY={crowded && index % 2 === 1 ? "top" : "bottom"}
          color={outcome === target ? highlight : ink}
          fontSize="compact"
          gap={0.002}
          key={outcome}
          position={[stackX(index, outcomes.length), RACK.height, NUMBER_Z]}
        >
          {String(outcome)}
        </ThreeLabel>
      ))}
    </group>
  );
}

/** The profile of a moulded counting chip: a raised rim round a shallow dish, turned about its axis. */
const CHIP_PROFILE = Arr.map(
  [
    [0, 0.0006],
    [0.0061, 0.0006],
    [0.0067, 0.001],
    [0.0089, 0.001],
    [CHIP.radius, 0.0006],
    [CHIP.radius, -0.0006],
    [0.0089, -0.001],
    [0, -0.001],
  ] as const,
  ([radius, height]) => new Vector2(radius, height)
);

/** What the scene calls to restack the chips for a new tally. */
export interface ChipsHandle {
  readonly restack: (counts: readonly number[], target: number) => void;
}

/**
 * Every chip of the tally as one instanced mesh with room for a chip per
 * roll, so a new roll only moves matrices and never builds a mesh. The
 * target's stack takes the highlight colour.
 */
export function Chips({
  capacity,
  highlight,
  ref,
}: {
  readonly capacity: number;
  readonly highlight: string;
  readonly ref: Ref<ChipsHandle>;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const tools = useMemo(
    () => ({
      chip: new Color(DICE_COLORS.chip),
      highlight: new Color(highlight),
      matrix: new Matrix4(),
      scale: new Vector3(1, 1, 1),
      turn: new Quaternion(),
      up: new Vector3(0, 1, 0),
      where: new Vector3(),
    }),
    [highlight]
  );

  useImperativeHandle(
    ref,
    () => ({
      restack: (counts, target) => {
        const target3d = mesh.current;
        if (target3d === null) {
          return;
        }
        const chips = chipPlacements(counts);
        Arr.forEach(chips, (chip, index) => {
          tools.where.set(...chip.position);
          tools.turn.setFromAxisAngle(tools.up, chip.spin);
          tools.matrix.compose(tools.where, tools.turn, tools.scale);
          target3d.setMatrixAt(index, tools.matrix);
          target3d.setColorAt(
            index,
            chip.stack === target ? tools.highlight : tools.chip
          );
        });
        target3d.count = chips.length;
        target3d.instanceMatrix.needsUpdate = true;
        if (target3d.instanceColor !== null) {
          target3d.instanceColor.needsUpdate = true;
        }
        target3d.computeBoundingSphere();
      },
    }),
    [tools]
  );

  return (
    <instancedMesh
      args={[undefined, undefined, capacity]}
      castShadow
      receiveShadow
      ref={mesh}
    >
      <latheGeometry args={[CHIP_PROFILE, 40]} />
      <Matter color={DICE_COLORS.chip} of="plastic" />
    </instancedMesh>
  );
}

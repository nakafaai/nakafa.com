import { useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CaseCells,
  FELT_TOP,
  FeltBoard,
} from "@repo/design-system/components/contents/mathematics/counterexample/board";
import {
  CARD,
  ClaimCard,
} from "@repo/design-system/components/contents/mathematics/counterexample/card";
import type {
  Claim,
  Tile,
} from "@repo/design-system/components/contents/mathematics/counterexample/claim";
import {
  caseOf,
  deciderOf,
  holds,
  verdictOf,
} from "@repo/design-system/components/contents/mathematics/counterexample/claim";
import {
  gridLayout,
  sortLayout,
  TILE,
} from "@repo/design-system/components/contents/mathematics/counterexample/layout";
import { poseOf } from "@repo/design-system/components/contents/mathematics/counterexample/pose";
import {
  activeAt,
  checkedAt,
  STAMP,
  stampAt,
  sweepEnd,
} from "@repo/design-system/components/contents/mathematics/counterexample/sweep";
import { TileModel } from "@repo/design-system/components/contents/mathematics/counterexample/tile";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { COUNTEREXAMPLE_COLORS } from "@repo/design-system/lib/material/counterexample";
import { Array as Arr, Option } from "effect";
import { useMemo, useRef, useState } from "react";
import type { Color, Group } from "three";
import { Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";

/** How much darker a tile outside the claim, or safe for it, becomes once it is checked. */
const DIM = 0.45;

/** How far the colored spot under a tile reaches past the tile's edge. */
const SPOT = 0.008;

/** The gap between the board's frame and the claim card. */
const CARD_GAP = 0.05;

/**
 * Darkens every surface of one tile by `dim`, so a tile outside the claim
 * recedes and keeps its own color. Each material keeps its own color the
 * first time it is shaded, so shading never drifts.
 */
function shade(object: Group, dim: number) {
  object.traverse((part) => {
    if (
      !(part instanceof Mesh && part.material instanceof MeshStandardMaterial)
    ) {
      return;
    }
    const material = part.material;
    const own: Color = material.userData.own ?? material.color.clone();
    material.userData.own = own;
    material.color.copy(own).multiplyScalar(1 - DIM * dim);
  });
}

/** Sets the opacity of every material in the stamp, as it is inked onto the card. */
function ink(object: Group, opacity: number) {
  object.traverse((part) => {
    if (part instanceof Mesh && part.material instanceof MeshStandardMaterial) {
      part.material.opacity = opacity;
    }
  });
}

/**
 * The tiles on a felt board, the claim on a card behind them, and, for an
 * implication whose answer shows, the four cells of the case board. Playing
 * checks the tiles one by one: with the answer shown, each tile gets a spot
 * of its verdict's color, a counterexample or an example stands up, a tile
 * outside the claim darkens, and on the case board each tile is carried to
 * the cell of its case; the stamp comes down once the claim is settled.
 * Still, the scene shows every tile checked. With the answer hidden, playing
 * only lifts each tile in turn. Pressing a tile picks it: it is held up to
 * the camera.
 */
export function CounterexampleScene({
  claim,
  onPick,
  picked,
  showAnswer,
  stamp,
  text,
  tiles,
}: {
  readonly claim: Claim;
  readonly onPick: (index: number) => void;
  readonly picked: Option.Option<number>;
  readonly showAnswer: boolean;
  readonly stamp: string;
  readonly text: string;
  readonly tiles: readonly Tile[];
}) {
  const sorting = showAnswer && claim.kind === "if";
  const verdicts = useMemo(
    () => Arr.map(tiles, (tile) => verdictOf(claim, tile)),
    [claim, tiles]
  );
  const grid = useMemo(() => gridLayout(tiles.length), [tiles.length]);
  const sort = useMemo(
    () => sortLayout(Arr.map(tiles, (tile) => caseOf(claim, tile))),
    [claim, tiles]
  );
  const board = sorting ? sort.board : grid.board;
  const decider = deciderOf(claim, tiles);
  const truth = holds(claim, tiles);
  const { advance, playing } = useTimeline(0, sweepEnd(tiles.length) + STAMP);
  const holders = useRef<(Group | null)[]>([]);
  const spots = useRef<(Mesh | null)[]>([]);
  const stamper = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  useFrame((_, delta) => {
    const time = advance(delta);
    const active = activeAt(time, tiles.length);
    Arr.forEach(tiles, (_tile, index) => {
      const holder = holders.current[index];
      const spot = spots.current[index];
      if (!(holder && spot)) {
        return;
      }
      const verdict = Arr.getUnsafe(verdicts, index);
      const from = Arr.getUnsafe(grid.places, index);
      const pose = poseOf({
        checked: showAnswer ? checkedAt(time, index) : 0,
        from,
        held: Option.contains(picked, index),
        scanning: Option.contains(active, index),
        to: sorting ? Arr.getUnsafe(sort.places, index) : from,
        verdict,
      });
      holder.position.set(
        pose.x,
        FELT_TOP + TILE.height / 2 + pose.lift,
        pose.z
      );
      holder.rotation.x = pose.tilt;
      shade(holder, pose.dim);
      spot.position.set(pose.x, FELT_TOP + 0.0012, pose.z);
      spot.visible = pose.spot > 0;
      if (spot.material instanceof MeshBasicMaterial) {
        spot.material.color.set(
          showAnswer
            ? COUNTEREXAMPLE_COLORS[verdict]
            : COUNTEREXAMPLE_COLORS.picked
        );
        spot.material.opacity = pose.spot;
      }
    });
    const stampDown = stamper.current;
    if (stampDown) {
      const down = stampAt(time, decider, tiles.length);
      stampDown.visible = down > 0;
      stampDown.scale.setScalar(1 + 0.35 * (1 - down));
      ink(stampDown, down);
    }
  });

  const cardZ = -(board.depth / 2 + CARD_GAP);

  return (
    <group>
      <SimulationTicker running={playing} />
      <CounterexampleCamera depth={board.depth} width={board.width} />
      <FeltBoard size={board} />
      {sorting ? <CaseCells sort={sort} /> : null}
      <group position={[0, 0, cardZ]}>
        <ClaimCard
          ref={stamper}
          stamp={
            showAnswer
              ? {
                  ink: truth
                    ? COUNTEREXAMPLE_COLORS.green
                    : COUNTEREXAMPLE_COLORS.red,
                  word: stamp,
                }
              : undefined
          }
          text={text}
          width={board.width}
        />
      </group>
      {Arr.map(tiles, (tile, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a tile is its place in the lesson's list, which may hold two equal tiles.
        <group key={index}>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: a three.js group takes pointer events, not focus; the toolbar's tile list is the keyboard and screen reader control for the same tile. */}
          <group
            onClick={(event) => {
              event.stopPropagation();
              onPick(index);
            }}
            onPointerOut={() => setHovered(false)}
            onPointerOver={(event) => {
              event.stopPropagation();
              setHovered(true);
            }}
            ref={(holder) => {
              holders.current[index] = holder;
            }}
          >
            <TileModel tile={tile} />
          </group>
          <mesh
            ref={(spot) => {
              spots.current[index] = spot;
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            visible={false}
          >
            <planeGeometry
              args={[TILE.side + 2 * SPOT, TILE.side + 2 * SPOT]}
            />
            <meshBasicMaterial
              depthWrite={false}
              opacity={0}
              toneMapped={false}
              transparent
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Looks down on the board and the card behind it from in front and above,
 * so every tile and the whole claim show; farther back and higher on a
 * narrow card.
 */
function CounterexampleCamera({
  depth,
  width,
}: {
  readonly depth: number;
  readonly width: number;
}) {
  const narrow = isNarrowThreeScene(
    useThree((three) => three.size),
    1.2
  );
  const back = depth / 2 + CARD_GAP + 2 * Math.sin(CARD.lean) * CARD.height;
  const front = depth / 2;
  const span = Math.max(width, (back + front) * 1.15);
  const distance = span * (narrow ? 1.95 : 1.5);
  const elevation = narrow ? 1.02 : 0.92;
  const target = [0, 0.02, (front - back) / 2] as const;

  return (
    <CameraControls
      cameraPosition={[
        0,
        target[1] + distance * Math.sin(elevation),
        target[2] + distance * Math.cos(elevation),
      ]}
      cameraTarget={target}
      fov={36}
      maxAzimuthAngle={0.7}
      maxDistance={distance * 1.6}
      maxPolarAngle={Math.PI / 2 - 0.15}
      minAzimuthAngle={-0.7}
      minDistance={distance * 0.4}
    />
  );
}

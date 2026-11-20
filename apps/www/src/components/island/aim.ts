import { Option, Result } from "effect";
import type { GameStoreApi } from "@/components/island/store";
import type { Ring } from "@/components/island/terrain";
import type { landHit } from "@/lib/island/land/ray";
import { footprintOf, seatOf, siteOf } from "@/lib/island/land/site";
import { reachOf } from "@/lib/island/land/stroke";

/** The ring's tint where a press will take, and where it will not. */
const TINT = {
  fine: [1, 0.97, 0.82],
  refused: [0.92, 0.3, 0.24],
} as const;

/** No ring on the ground. */
const NO_RING: Ring = { reach: 0, shown: 0, tint: TINT.fine, x: 0, z: 0 };

/** The game as the store holds it at one moment. */
type Game = ReturnType<GameStoreApi["getState"]>;

/** Where the pointer meets the land or its water, none when it meets neither or is not over the world. */
type Hit = ReturnType<typeof landHit>;

/** The ring the hand lays on the ground under the pointer (ADR 0050, W7): the brush's reach, or the footprint of the thing in hand, red where it would be refused; none while the hand only walks. */
export function ringOf(state: Game, hit: Hit): Ring {
  if (Option.isNone(hit) || state.host !== null) {
    return NO_RING;
  }
  const { x, z } = hit.value;
  if (state.mode === "brush") {
    return { reach: reachOf(state.brush), shown: 1, tint: TINT.fine, x, z };
  }
  if (state.mode !== "build" || state.item === null) {
    return NO_RING;
  }
  const [halfWidth, halfDepth] = footprintOf(state.item, state.turn);
  return {
    reach: Math.max(0.6, halfWidth, halfDepth),
    shown: 1,
    tint: Result.isSuccess(
      siteOf(state.land, state.item, x, z, state.turn, Option.none())
    )
      ? TINT.fine
      : TINT.refused,
    x,
    z,
  };
}

/** The thing in hand as a body under the pointer, so the learner sees it before it lands. */
export function ghostOf(state: Game, hit: Hit) {
  const { item, land, mode, turn } = state;
  if (mode !== "build" || item === null || Option.isNone(hit)) {
    return [];
  }
  const x = Math.round(hit.value.x * 2) / 2;
  const z = Math.round(hit.value.z * 2) / 2;
  return [
    [
      { _tag: "thing", kind: item, look: 0 },
      new Float32Array([
        x,
        seatOf(land, item, x, z, turn),
        z,
        (turn * Math.PI) / 2,
        0,
        0,
      ]),
    ] as const,
  ];
}

import type { Layout } from "@repo/design-system/components/contents/mathematics/logic/circuit";
import { stackOf } from "@repo/design-system/components/contents/mathematics/logic/circuit";
import {
  BITE_Y,
  BOARD_TOP,
  CLIP,
  WIRE_RADIUS,
} from "@repo/design-system/components/contents/mathematics/logic/rig";
import { Array as Arr } from "effect";

/** A point in the scene, in metres. */
type Point = readonly [number, number, number];

/** How far past a clip's boot a lead comes down to lie on the board. */
export const DROP = 0.014;

/** The gap between two marks of current along a lead, and how fast they run, in metres and metres a second. */
export const CURRENT = { gap: 0.022, speed: 0.03 } as const;

/** The unit step on the board from one spot toward another. */
function toward(
  from: readonly [number, number],
  to: readonly [number, number]
) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  return [dx / length, dz / length] as const;
}

/** The ends of one lead: each post, the way its clip points, and how high the clip stacks. */
function endsOf(layout: Layout, lead: number) {
  const each = Arr.getUnsafe(layout.leads, lead);
  const first = Arr.headNonEmpty(each.via);
  const last = Arr.lastNonEmpty(each.via);
  return {
    end: {
      direction: toward(each.end, last),
      post: each.end,
      y: BITE_Y + stackOf(layout, lead, "to") * CLIP.rise,
    },
    start: {
      direction: toward(each.start, first),
      post: each.start,
      y: BITE_Y + stackOf(layout, lead, "from") * CLIP.rise,
    },
  };
}

/**
 * The clip at one end of a lead. It points from its post toward the lead's
 * first or last turn, and its heading is its turn about the vertical, as
 * three.js turns an object whose length lies along x.
 */
export function clipPose(layout: Layout, lead: number, end: "from" | "to") {
  const ends = endsOf(layout, lead);
  const { direction, post, y } = end === "from" ? ends.start : ends.end;
  return {
    heading: Math.atan2(-direction[1], direction[0]),
    jaw: [post[0], y, post[1]] as const,
  };
}

/**
 * The path of a lead's insulation: out of the boot of the clip on its first
 * post, down onto the board, along the board through its turns, and up into
 * the boot of the clip on its last post.
 */
export function leadPath(layout: Layout, lead: number): readonly Point[] {
  const { end, start } = endsOf(layout, lead);
  const lying = BOARD_TOP + WIRE_RADIUS;
  const out = (side: typeof start, distance: number, height: number): Point => [
    side.post[0] + side.direction[0] * distance,
    height,
    side.post[1] + side.direction[1] * distance,
  ];
  const turns = Arr.map(
    Arr.getUnsafe(layout.leads, lead).via,
    ([x, z]): Point => [x, lying, z]
  );
  return [
    out(start, CLIP.length, start.y),
    out(start, CLIP.length + DROP, lying),
    ...turns,
    out(end, CLIP.length + DROP, lying),
    out(end, CLIP.length, end.y),
  ];
}

/**
 * Where the marks of current stand along a lead `length` long at `time`, each
 * as a share of the way from its start: one mark every `CURRENT.gap`, all
 * running at `CURRENT.speed` toward its end and coming round again.
 */
export function marksAlong(length: number, time: number) {
  const count = Math.max(1, Math.floor(length / CURRENT.gap));
  const spacing = length / count;
  const travelled = (time * CURRENT.speed) % spacing;
  return Arr.makeBy(count, (mark) => (mark * spacing + travelled) / length);
}

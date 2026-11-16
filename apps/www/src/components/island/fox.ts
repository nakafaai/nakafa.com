import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import type { GameStoreApi } from "@/components/island/store";
import { turnOf } from "@/lib/island/items";
import type { Animal } from "@/lib/island/life";
import { pathOf } from "@/lib/island/path";
import { touches } from "@/lib/island/room";
import { footingAt, STRIDE } from "@/lib/island/steps";

/** How fast the learner's fox walks, in cells a second. */
const WALK_SPEED = 3.2;

/**
 * The learner's own fox (ADR 0047, D12, D22 and D40): where it stands, the
 * route it walks, and its footsteps. It starts on the village square, walks
 * the shortest way to where the learner sends it, waits for an animal in its
 * way instead of walking through it, and treads once a stride on whatever its
 * paws land on, which the sound answers. The canvas carries its column and
 * whether it walks, for the browser specs.
 */
export function createFox(store: GameStoreApi, canvas: HTMLCanvasElement) {
  let at = { x: SPAN / 2 + 0.5, z: SPAN / 2 + 2.5 };
  let route: readonly (readonly [number, number])[] = [];
  let walked = 0;
  const show = () => {
    canvas.dataset.player = `${Math.floor(at.x)},${Math.floor(at.z)}`;
    canvas.dataset.walking = route.length > 0 ? "true" : "false";
  };
  show();

  /** The fox as an animal at its place, heading for (tx, tz), for the checks that keep bodies apart and for the painter. */
  const animal = (tx = at.x, tz = at.z): Animal => ({
    kind: "fox",
    rest: route.length > 0 ? 0 : 1,
    steps: 0,
    tx,
    tz,
    x: at.x,
    z: at.z,
  });

  /** Sends the fox along the shortest way to a column, or says no way leads there. Whether it set off. */
  const walkTo = (column: readonly [number, number]) =>
    Option.match(
      pathOf(
        store.getState().cells,
        [Math.floor(at.x), Math.floor(at.z)],
        column
      ),
      {
        onNone: () => {
          store.getState().setNotice("path");
          return false;
        },
        onSome: (found) => {
          route = found;
          show();
          return true;
        },
      }
    );

  return {
    animal,
    /** Where the fox stands. */
    at: () => at,
    /**
     * Moves the fox along its route for `dt` seconds, unless an animal of the
     * herd stands in its way, and treads once each stride. The cell it heads
     * for, and whether it moved.
     */
    advance(dt: number, herd: readonly Animal[]) {
      const next = Arr.head(route);
      const moved = Option.match(next, {
        onNone: () => false,
        onSome: ([cx, cz]) => {
          const dx = cx + 0.5 - at.x;
          const dz = cz + 0.5 - at.z;
          const distance = Math.hypot(dx, dz);
          const reach = WALK_SPEED * dt;
          const to =
            distance <= reach
              ? { x: cx + 0.5, z: cz + 0.5 }
              : {
                  x: at.x + (dx / distance) * reach,
                  z: at.z + (dz / distance) * reach,
                };
          const stepped = { ...animal(cx + 0.5, cz + 0.5), x: to.x, z: to.z };
          const nearer = (other: Animal) =>
            Math.hypot(to.x - other.x, to.z - other.z) <
            Math.hypot(at.x - other.x, at.z - other.z);
          if (
            Arr.some(herd, (other) => nearer(other) && touches(stepped, other))
          ) {
            return false;
          }
          walked += Math.min(distance, reach);
          at = to;
          if (distance <= reach) {
            route = Arr.drop(route, 1);
          }
          if (walked >= STRIDE) {
            walked -= STRIDE;
            Option.map(
              footingAt(store.getState().cells, at.x, at.z),
              (footing) => store.getState().tread(footing)
            );
          }
          show();
          return true;
        },
      });
      return { moved, next };
    },
    /** Walks the fox one cell, right (`across`) or away from the camera (`ahead` negative), as a camera at `yaw` faces. */
    step(across: number, ahead: number, yaw: number) {
      const [dx, dz] = [
        [across, ahead],
        [ahead, -across],
        [-across, -ahead],
        [-ahead, across],
      ][turnOf(yaw)];
      const last = Option.getOrElse(
        Arr.last(route),
        () => [Math.floor(at.x), Math.floor(at.z)] as const
      );
      return walkTo([last[0] + dx, last[1] + dz]);
    },
    walkTo,
    /** Whether the fox is on its way somewhere. */
    walking: () => route.length > 0,
  };
}

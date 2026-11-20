import { Option } from "effect";
import type { GameStoreApi } from "@/components/island/store";
import { cacheOf, standingAbout } from "@/lib/island/blockers";
import type { Animal } from "@/lib/island/life";
import { followed, REACH, routeOf } from "@/lib/island/route";
import type { Drive } from "@/lib/island/walker";
import { jumped, PACE, REST, stepWalker, walkerAt } from "@/lib/island/walker";

/** How far about the fox the things it may bump into are read, in blocks. */
const NEAR = 2;

/** How far past the fox and a pressed place a route may go around something, in blocks, which is how far about them what stands is read. */
const AROUND = 16;

/** The longest moment the fox is moved by in one go, in seconds, so a frame that came late never throws it through a wall. */
const MOMENT = 0.1;

/** How long the fox pushes against something on a route before it gives the route up, in seconds. */
const STUCK = 0.4;

/** How slow the fox counts as standing, in blocks a second. */
const STILL = 0.05;

/**
 * The learner's own fox (ADR 0047, D12, D22 and D40; ADR 0050, W1): a body
 * with weight that walks, runs, swims and jumps over the land. Held keys
 * drive it as the camera faces; a press sends it along a route, which the
 * keys take over again; and it treads once a stride on whatever its paws
 * land on, which the sound answers. It starts at the place the stage hands
 * it, and the canvas carries the place it stands on and whether it walks,
 * for the browser specs.
 */
export function createFox(
  store: GameStoreApi,
  canvas: HTMLCanvasElement,
  start: readonly [number, number]
) {
  const cache = cacheOf();
  let walker = walkerAt(store.getState().land, start[0], start[1]);
  let route: readonly (readonly [number, number])[] = [];
  let held: Drive = REST;
  let stuck = 0;

  /** Whether the fox is on its way somewhere, driven or still carried by its own weight. */
  const walking = () =>
    route.length > 0 ||
    held.speed > 0 ||
    walker.airborne ||
    Math.hypot(walker.speedX, walker.speedZ) > STILL;

  const show = () => {
    canvas.dataset.player = `${Math.floor(walker.x)},${Math.floor(walker.z)}`;
    canvas.dataset.walking = walking() ? "true" : "false";
  };
  show();

  return {
    /**
     * Moves the fox on by `seconds`: toward what the keys hold, or along its
     * route, around everything that stands near it; and treads each footstep.
     * Whether it moved.
     */
    advance(seconds: number) {
      const state = store.getState();
      const along = followed(route, walker.x, walker.z);
      route = along.route;
      const next = stepWalker(
        state.land,
        walker,
        held.speed > 0 ? held : along.drive,
        standingAbout(
          cache,
          state.land,
          state.revision,
          [walker.x, walker.z],
          NEAR
        ),
        Math.min(seconds, MOMENT)
      );
      const moved = next.walker.x !== walker.x || next.walker.z !== walker.z;
      walker = next.walker;
      stuck = next.blocked ? stuck + seconds : 0;
      if (stuck > STUCK) {
        route = [];
        stuck = 0;
      }
      Option.map(next.footstep, (footing) => state.tread(footing));
      show();
      return { moved };
    },
    /** The fox as the animal the scene draws: where it stands, facing (tx, tz) when a place is given and the way it moves when not, at rest unless it walks. */
    animal(tx?: number, tz?: number): Animal {
      return {
        kind: "fox",
        rest: walking() ? 0 : 1,
        steps: 0,
        tx: tx ?? walker.x + Math.sin(walker.yaw),
        tz: tz ?? walker.z + Math.cos(walker.yaw),
        x: walker.x,
        z: walker.z,
      };
    },
    /** Where the fox's feet are. */
    at: () => ({ x: walker.x, y: walker.y, z: walker.z }),
    /**
     * Holds a direction for the fox to go, already in the world's own axes,
     * at a run or at a walk; nothing held lets it come to rest. A held
     * direction takes over from a route.
     */
    hold(across: number, ahead: number, run: boolean) {
      const length = Math.hypot(across, ahead);
      if (length === 0) {
        held = REST;
        return;
      }
      held = {
        speed: run ? PACE.run : PACE.walk,
        x: across / length,
        z: ahead / length,
      };
      route = [];
    },
    /** Lifts the fox off the ground in a jump. */
    jump() {
      walker = jumped(walker);
    },
    /** How fast the fox moves over the ground along x and z, in blocks a second. */
    velocity: () => [walker.speedX, walker.speedZ] as const,
    /** Sends the fox along the cheapest way to a place, or says no way leads there. Whether it set off. */
    walkTo(x: number, z: number) {
      const state = store.getState();
      const from = [walker.x, walker.z] as const;
      const span = Math.max(Math.abs(x - from[0]), Math.abs(z - from[1]));
      const found =
        span > REACH
          ? Option.none()
          : routeOf(
              state.land,
              standingAbout(
                cache,
                state.land,
                state.revision,
                [(from[0] + x) / 2, (from[1] + z) / 2],
                span / 2 + AROUND
              ),
              from,
              [x, z]
            );
      return Option.match(found, {
        onNone: () => {
          state.setNotice("far");
          return false;
        },
        onSome: (places) => {
          route = places;
          stuck = 0;
          show();
          return true;
        },
      });
    },
    walking,
    /** The way the fox faces, in radians from +z toward +x. */
    yaw: () => walker.yaw,
  };
}

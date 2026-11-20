import { regionOf } from "@repo/backend/confect/island/chunk";
import { Array as Arr, Option, Result } from "effect";
import type { Painter } from "@/components/island/draw";
import type { createFox } from "@/components/island/fox";
import type { createProps } from "@/components/island/props";
import type { createRod } from "@/components/island/rod";
import type { GameStoreApi } from "@/components/island/store";
import type { createWorld } from "@/components/island/world";
import { REACH, waterAt } from "@/lib/island/fishing";
import type { Point } from "@/lib/island/gesture";
import { moved, pickUp, setDown, turned } from "@/lib/island/land/build";
import { CHUNK, keyOf } from "@/lib/island/land/chunk";
import { heightAt } from "@/lib/island/land/ground";
import type { landHit } from "@/lib/island/land/ray";
import { thingNear } from "@/lib/island/land/site";
import { dabChanges } from "@/lib/island/land/stroke";
import type { rayThrough } from "@/lib/island/matrix";

/** The least time between two dabs of one stroke, in milliseconds, so a slow drag shapes the land no faster than a quick one. */
const DAB_REST = 90;

/** How near the fox must stand to stroke an animal or shake a tree, in blocks; farther, it walks there first. */
const ARM = 6;

/** Where about the home the gift camp fire is tried, in blocks from it, the first place that takes it first. */
const HEARTH = [
  [2, 1],
  [-2, 1],
  [1, -2],
  [3, 3],
  [-3, -3],
  [0, 4],
] as const;

/** What the hand acts on and through: the bodies of the stage, where a point of the screen meets the world, and the stage's clock. */
interface Stage {
  readonly fox: ReturnType<typeof createFox>;
  /** Where a point of the screen meets the land or its water, none when it meets neither. */
  readonly hitAt: (point: Point) => ReturnType<typeof landHit>;
  readonly home: readonly [number, number];
  readonly painter: Painter;
  readonly props: ReturnType<typeof createProps>;
  /** The ray from the lens through a point of the screen. */
  readonly rayAt: (point: Point) => ReturnType<typeof rayThrough>;
  readonly rod: ReturnType<typeof createRod>;
  /** The moment of the frame last drawn, in seconds. */
  readonly seconds: () => number;
  readonly world: ReturnType<typeof createWorld>;
}

/**
 * The learner's hand in the world (ADR 0050, W2 and W7): what a press does
 * where it meets a body or the land in each mode, a dab of the brush, turning
 * and taking away the thing selected, and the gift camp fire of a first
 * visit. Every change goes through the store, which sends it on.
 */
export function createHand(store: GameStoreApi, stage: Stage) {
  const { fox, hitAt, home, painter, props, rayAt, rod, seconds, world } =
    stage;
  const { land } = store.getState();
  let level = 0;
  let lastDab = 0;

  /** Whether the learner may change the land at a place: it is their own world, and what the server holds there has arrived. */
  const mayChange = (x: number, z: number) => {
    const state = store.getState();
    return (
      state.host === null &&
      Arr.contains(
        state.loaded,
        keyOf(regionOf(Math.floor(x / CHUNK)), regionOf(Math.floor(z / CHUNK)))
      )
    );
  };

  /** A press on a body of the world while the learner explores (W6 and W9): the fox strokes an animal or shakes a tree it stands by, and walks to one that is farther. Whether the press met a body it answers. */
  const meet = (point: Point) => {
    const paws = fox.at();
    return Option.match(world.touch(rayAt(point)), {
      onNone: () => false,
      onSome: (met) => {
        const [x, z] =
          met._tag === "animal" ? [met.animal.x, met.animal.z] : [met.x, met.z];
        if (Math.hypot(x - paws.x, z - paws.z) > ARM) {
          return met._tag === "animal" && fox.walkTo(x, z);
        }
        if (met._tag === "animal") {
          world.pet(met.animal);
          store.getState().did("pet");
          return true;
        }
        const dropped = props.shake(met.x, met.y, met.z, met.kind);
        if (dropped) {
          store.getState().did("shake");
        }
        return dropped;
      },
    });
  };

  /** Sets down, moves or picks up at a place, as the build hand does (W2). */
  const build = (x: number, z: number) => {
    const state = store.getState();
    if (!mayChange(x, z)) {
      return;
    }
    if (state.moving && state.selected !== null) {
      Result.match(moved(land, state.selected, x, z), {
        onFailure: state.setNotice,
        onSuccess: (changes) => {
          state.commit(changes);
          state.select(null);
        },
      });
      return;
    }
    if (state.item !== null) {
      Result.match(setDown(land, state.item, x, z, state.turn), {
        onFailure: state.setNotice,
        onSuccess: (changes) => {
          state.commit(changes);
          painter.burst([x, heightAt(land, x, z), z], "dust", seconds());
        },
      });
      return;
    }
    state.select(Option.getOrNull(thingNear(land, x, z)));
  };

  /** A press at a place while the learner explores (W7): it reels a line in, kicks what lies loose there, casts into water the fox stands by, or sends the fox there. */
  const explore = (x: number, z: number) => {
    const paws = fox.at();
    if (rod.active()) {
      rod.press({ x, z }, [paws.x, paws.z], seconds());
      return;
    }
    if (props.touch(x, z, paws)) {
      return;
    }
    const inReach = Math.hypot(x - paws.x, z - paws.z) <= REACH;
    if (inReach && !fox.walking() && Option.isSome(waterAt(land, x, z))) {
      rod.press({ x, z }, [paws.x, paws.z], seconds());
      return;
    }
    fox.walkTo(x, z);
  };

  return {
    /** One dab of the brush in hand where a point of the screen meets the land. */
    dab: (point: Point, first: boolean) => {
      const now = performance.now();
      if (!first && now - lastDab < DAB_REST) {
        return;
      }
      Option.map(hitAt(point), (hit) => {
        if (!mayChange(hit.x, hit.z)) {
          return;
        }
        lastDab = now;
        const state = store.getState();
        if (first) {
          level = heightAt(land, hit.x, hit.z);
        }
        const changes = dabChanges(land, state.brush, hit.x, hit.z, level);
        state.commit(changes, !first);
        if (changes.length > 0) {
          painter.burst([hit.x, hit.y, hit.z], state.brush, now / 1000);
        }
      });
    },
    /** A press at a point of the screen: the hand's own act where it meets the land. */
    press: (point: Point) => {
      const state = store.getState();
      if (state.mode === "explore" && !rod.active() && meet(point)) {
        return;
      }
      Option.map(hitAt(point), (hit) => {
        if (state.mode === "build") {
          build(hit.x, hit.z);
          return;
        }
        if (state.mode === "explore") {
          explore(hit.x, hit.z);
        }
      });
    },
    /** Takes the selected thing away. */
    take: () => {
      const state = store.getState();
      if (state.selected !== null) {
        state.commit(pickUp(land, state.selected));
        state.select(null);
      }
    },
    /** Turns the selected thing a quarter where it stands, or the hand when nothing is selected. */
    twist: () => {
      const state = store.getState();
      if (state.selected === null) {
        state.turnHand();
        return;
      }
      Result.match(turned(land, state.selected), {
        onFailure: state.setNotice,
        onSuccess: state.commit,
      });
    },
    /** Lays the gift camp fire by the home the first time the learner enters (W5), once what the server holds there has arrived. */
    welcome: () => {
      if (!(store.getState().first && mayChange(home[0], home[1]))) {
        return;
      }
      const laid = Arr.findFirst(HEARTH, ([across, deep]) =>
        Result.getSuccess(
          setDown(land, "campfire", home[0] + across, home[1] + deep, 0)
        )
      );
      store.getState().grant(Option.getOrElse(laid, () => []));
    },
  };
}

"use client";

import { useRequired } from "@repo/design-system/hooks/required";
import { createFramePace } from "@repo/design-system/lib/pace";
import { Array as Arr, DateTime, Option } from "effect";
import { useState } from "react";
import { ghostOf, ringOf } from "@/components/island/aim";
import type { Painter } from "@/components/island/draw";
import { createPainter } from "@/components/island/draw";
import { createFox } from "@/components/island/fox";
import { createHand } from "@/components/island/hand";
import { bindInput } from "@/components/island/input";
import { createProps } from "@/components/island/props";
import { createRod } from "@/components/island/rod";
import type { GameStoreApi } from "@/components/island/store";
import { GameStoreContext } from "@/components/island/store";
import { createWorld } from "@/components/island/world";
import type { Point } from "@/lib/island/gesture";
import { heightAt, surfaceAt } from "@/lib/island/land/ground";
import { landHit } from "@/lib/island/land/ray";
import { rayThrough } from "@/lib/island/matrix";
import { RUNGS, stepLadder, TOP_RUNG } from "@/lib/island/quality";
import {
  followRig,
  orbitOf,
  panRig,
  restRig,
  rigAt,
  stepRig,
  turnRig,
  zoomRig,
} from "@/lib/island/rig";
import { hourOf } from "@/lib/island/sky";

/** The longest the world waits for what the server holds about its home before it opens on the land alone, in milliseconds. */
const OPEN_WAIT = 4000;

/**
 * The world on the whole screen (ADR 0047, D1 and D2; ADR 0050, W7): the
 * canvas the painter draws into, the loop that redraws it, and the gestures
 * that move the camera, walk the fox, set things down and shape the land. It
 * starts once the canvas exists and stops when it leaves. `home` is where the
 * world opens.
 */
export function IslandStage({ home }: { home: readonly [number, number] }) {
  const store = useRequired(GameStoreContext, "IslandStage");
  const [failed, setFailed] = useState(false);
  // A lost context comes back as a new canvas, which the painter starts over on.
  const [context, setContext] = useState(0);
  return failed ? (
    <p className="text-paper absolute inset-0 grid place-items-center p-8 text-center">
      WebGL2
    </p>
  ) : (
    <canvas
      className="absolute inset-0 block size-full touch-none select-none [image-rendering:pixelated]"
      data-testid="island-stage"
      key={context}
      onContextMenu={(event) => event.preventDefault()}
      ref={(canvas) => {
        if (canvas === null) {
          return;
        }
        const painter = createPainter(canvas, store.getState().season);
        if (Option.isNone(painter)) {
          setFailed(true);
          return;
        }
        const lost = (event: Event) => event.preventDefault();
        const restored = () => setContext((count) => count + 1);
        canvas.addEventListener("webglcontextlost", lost);
        canvas.addEventListener("webglcontextrestored", restored);
        const stop = start(canvas, painter.value, store, home);
        return () => {
          canvas.removeEventListener("webglcontextlost", lost);
          canvas.removeEventListener("webglcontextrestored", restored);
          stop();
        };
      }}
    />
  );
}

/** Runs the game on one canvas until the returned cleanup stops it. */
function start(
  canvas: HTMLCanvasElement,
  painter: Painter,
  store: GameStoreApi,
  home: readonly [number, number]
) {
  const { land } = store.getState();
  /** The height of whatever tops a place: the ground or the water over it. */
  const top = (x: number, z: number) =>
    Math.max(heightAt(land, x, z), surfaceAt(land, x, z));
  const world = createWorld(
    painter,
    land,
    Math.floor(DateTime.toEpochMillis(DateTime.nowUnsafe()) / 86_400_000)
  );
  const fox = createFox(store, canvas, home);
  const props = createProps(store);
  const rod = createRod(store);
  let rig = rigAt(home[0], top(home[0], home[1]), home[1]);
  let frame = 0;
  let last = 0;
  // The quality ladder (D44) reads only frames drawn on two ticks in a row.
  let ladder = TOP_RUNG;
  let drewLast = false;
  let pointer = Option.none<Point>();
  let began = 0;

  /** The ray from the lens through a point of the screen. */
  const rayAt = (point: Point) => {
    const rect = canvas.getBoundingClientRect();
    return rayThrough(
      orbitOf(rig),
      rect.width / Math.max(1, rect.height),
      ((point.x - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      1 - ((point.y - rect.top) / Math.max(1, rect.height)) * 2
    );
  };

  /** Where a point of the screen meets the land or its water, none when it meets neither. */
  const hitAt = (point: Point) => {
    const ray = rayAt(point);
    return landHit(land, ray.origin, ray.direction);
  };

  /** Keeps the line out only while the fox stands by it, and warns of its bite. */
  const tendLine = (seconds: number) => {
    if (rod.active() && fox.walking()) {
      rod.stow();
    }
    rod.tend(seconds);
  };

  const hand = createHand(store, {
    fox,
    hitAt,
    home,
    painter,
    props,
    rayAt,
    rod,
    seconds: () => last / 1000,
    world,
  });

  const pace = createFramePace();
  /** Feeds the quality ladder a frame drawn right after another (D44), and steps the painter down a rung when it says so. */
  const measure = (seconds: number) => {
    const next = stepLadder(ladder, seconds);
    if (next.rung !== ladder.rung) {
      painter.quality(RUNGS[next.rung]);
      canvas.dataset.quality = String(next.rung);
    }
    ladder = next;
  };

  /** Whether the world is open: it opens once what the server holds about its home has arrived, so nothing the learner built appears a moment late, or after a wait on a slow network. */
  const openNow = (now: number, wanted: readonly number[]) => {
    const state = store.getState();
    if (state.shown) {
      return true;
    }
    began = began === 0 ? now : began;
    const arrived = Arr.every(wanted, (region) =>
      Arr.contains(state.loaded, region)
    );
    if (!arrived && now - began < OPEN_WAIT) {
      return false;
    }
    state.show();
    return true;
  };

  /** Whether nothing more arrives by itself: the server answered the entry, the gift of a first visit landed, and every region about the camera is held. */
  const restsNow = (wanted: readonly number[]) => {
    const state = store.getState();
    return (
      (state.answered || state.host !== null) &&
      !state.first &&
      Arr.every(wanted, (region) => Arr.contains(state.loaded, region))
    );
  };

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    const passed = last === 0 ? 0 : Math.min(0.25, (now - last) / 1000);
    if (document.hidden || !pace.isDue(now)) {
      drewLast = false;
      return;
    }
    if (drewLast) {
      measure(passed);
    }
    drewLast = true;
    last = now;
    const state = store.getState();
    fox.advance(passed);
    props.advance(passed, fox.at());
    tendLine(now / 1000);
    const paws = fox.at();
    if (Math.hypot(paws.x - state.place[0], paws.z - state.place[1]) > 2) {
      state.setPlace([paws.x, paws.z]);
    }
    const [speedX, speedZ] = fox.velocity();
    rig = stepRig(rig, passed, { speedX, speedZ, ...fox.at() }, top);
    const wanted = world.regions(rig.x, rig.z);
    if (
      wanted.length !== state.wanted.length ||
      Arr.some(wanted, (region) => !Arr.contains(state.wanted, region))
    ) {
      state.want(wanted);
    }
    if (!openNow(now, wanted)) {
      return;
    }
    hand.welcome();
    const under = Option.flatMap(pointer, hitAt);
    // The world's hour, which lights it and keeps the villagers' day (D54).
    const hour = hourOf(DateTime.nowUnsafe(), DateTime.zoneMakeLocal());
    const minute = Math.floor(hour * 60) % (24 * 60);
    if (minute !== state.minute) {
      state.setMinute(minute);
    }
    world.frame({
      extra: [
        Option.match(rod.float(), {
          onNone: () => fox.animal(),
          onSome: ([x, z]) => fox.animal(x, z),
        }),
      ],
      focus: [rig.x, rig.z],
      ghosts: [
        ...props.bodies(),
        ...rod.bodies(now / 1000),
        ...ghostOf(state, under),
      ],
      hour,
      orbit: orbitOf(rig),
      passed,
      revision: state.revision,
      ring: ringOf(state, under),
      seconds: now / 1000,
      weather: state.weather,
    });
    canvas.dataset.drawn = "true";
    canvas.dataset.revision = String(state.revision);
    canvas.dataset.weather = state.weather;
    // The world rests once nothing more arrives by itself: the browser specs wait for it before they count changes.
    canvas.dataset.settled = String(restsNow(wanted));
    pace.rest(now);
  };
  frame = requestAnimationFrame(tick);

  const resize = new ResizeObserver(() => {
    // Every device pixel, so the browser never stretches the canvas by a fraction: the frame is enlarged by whole art pixels (D20).
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  });
  resize.observe(canvas);

  /** Shows the cursor of what the hand does, or a grabbing hand while the learner drags the world. */
  const showCursor = (dragging: boolean) => {
    const { mode } = store.getState();
    const resting = mode === "explore" ? "pointer" : "crosshair";
    canvas.style.cursor = dragging ? "grabbing" : resting;
  };
  showCursor(false);
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.mode !== previous.mode) {
      showCursor(false);
      canvas.dataset.mode = state.mode;
    }
  });
  canvas.dataset.mode = store.getState().mode;

  const input = bindInput(canvas, store, {
    dab: hand.dab,
    drag: showCursor,
    endStroke: () => undefined,
    follow: () => {
      rig = followRig(rig);
    },
    hold: (across, ahead, run) => {
      // The keys walk the fox as the camera faces: ahead is away from the lens.
      const [sin, cos] = [Math.sin(rig.yaw), Math.cos(rig.yaw)];
      fox.hold(-sin * ahead + cos * across, -cos * ahead - sin * across, run);
    },
    hover: (point) => {
      pointer = point;
    },
    jump: fox.jump,
    pan: (from, to, seconds) => {
      Option.map(Option.all([hitAt(from), hitAt(to)]), ([before, after]) => {
        rig = panRig(rig, before.x - after.x, before.z - after.z, seconds);
      });
    },
    press: hand.press,
    rest: () => {
      rig = restRig(rig);
    },
    take: hand.take,
    turn: (yaw, tilt, seconds) => {
      rig = turnRig(rig, yaw, tilt, seconds);
    },
    twist: hand.twist,
    zoom: (factor, toward) => {
      rig = zoomRig(
        rig,
        factor,
        Option.match(hitAt(toward), {
          onNone: () => [rig.goalX, rig.goalZ] as const,
          onSome: (hit) => [hit.x, hit.z] as const,
        })
      );
    },
  });

  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    unsubscribe();
    input.release();
    painter.release();
  };
}

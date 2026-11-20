"use client";

import { createFramePace } from "@repo/design-system/lib/pace";
import { Array as Arr, DateTime, Option } from "effect";
import { useState } from "react";
import type { Painter } from "@/components/island/draw";
import { createPainter } from "@/components/island/draw";
import { IslandRegions } from "@/components/island/regions";
import { createWorld } from "@/components/island/world";
import type { Land } from "@/lib/island/land/ground";
import { heightAt, landOf, surfaceAt } from "@/lib/island/land/ground";
import { homeOf } from "@/lib/island/land/home";
import { seedOf } from "@/lib/island/noise";
import { orbitOf, rigAt } from "@/lib/island/rig";
import { seasonNow } from "@/lib/island/season";
import { hourOf } from "@/lib/island/sky";

/** How far back the home page's still camera stands from the learner's home, in blocks: far enough that the camp, the water by it and the land around read in one glance. */
const BACK = 46;

/**
 * Draws the world into one canvas from a still camera over the learner's
 * home, its water and its life moving, until the returned cleanup stops it:
 * the same living scene as the game (ADR 0047, D53). `revision` answers how
 * many stored regions arrived, so the land is read again when one does.
 */
function preview(
  canvas: HTMLCanvasElement,
  painter: Painter,
  land: Land,
  home: readonly [number, number],
  revision: () => number
) {
  const world = createWorld(
    painter,
    land,
    Math.floor(DateTime.toEpochMillis(DateTime.nowUnsafe()) / 86_400_000)
  );
  const top = Math.max(
    heightAt(land, home[0], home[1]),
    surfaceAt(land, home[0], home[1])
  );
  const orbit = orbitOf({
    ...rigAt(home[0], top, home[1]),
    distance: BACK,
  });
  let frame = 0;
  let last = 0;
  // A canvas drawn before its size is known, or cleared by a new size, shows black until it is
  // drawn again, so the frame after a resize draws whatever the pace says.
  let fresh = true;
  // A preview's water and life move by themselves, so they keep to its share of the thread (ADR 0039,
  // D5) and rest while hidden or scrolled away (ADR 0047, D26).
  const pace = createFramePace();
  let inSight = true;
  const sight = new IntersectionObserver((entries) => {
    inSight = Arr.some(entries, (entry) => entry.isIntersecting);
  });
  sight.observe(canvas);
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    if (!(fresh || (pace.isDue(now) && inSight)) || document.hidden) {
      return;
    }
    fresh = false;
    // The scene lives on by the time that passed, at most a quarter second after a rest, so nothing leaps on return.
    const passed = last === 0 ? 0 : Math.min(0.25, (now - last) / 1000);
    last = now;
    world.frame({
      extra: [],
      focus: home,
      ghosts: [],
      hour: hourOf(DateTime.nowUnsafe(), DateTime.zoneMakeLocal()),
      orbit,
      passed,
      revision: revision(),
      ring: { reach: 0, shown: 0, tint: [1, 1, 1], x: 0, z: 0 },
      seconds: now / 1000,
      weather: "clear",
    });
    if (canvas.dataset.drawn !== "true") {
      // The browser presents this frame after the callback ends, so the next one says it shows.
      requestAnimationFrame(() => {
        canvas.dataset.drawn = "true";
      });
    }
    pace.rest(now);
  };
  const resize = new ResizeObserver(() => {
    // Every device pixel, so the browser never stretches the canvas by a fraction (D20).
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    fresh = true;
  });
  resize.observe(canvas);
  frame = requestAnimationFrame(tick);
  return {
    regions: world.regions(home[0], home[1]),
    stop: () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      sight.disconnect();
      painter.release();
    },
  };
}

/**
 * The learner's world as the home page shows it (ADR 0047, D27): the same
 * land and renderer as the game, seen from a still camera over their home,
 * with no HUD and no input. Its code loads once the reader is on the page.
 * `owner` is what the land's seed is made from.
 */
export default function IslandView({ owner }: { owner: string }) {
  const [world] = useState(() => {
    const seed = seedOf(owner);
    return { home: homeOf(seed), land: landOf(seed) };
  });
  const [wanted, setWanted] = useState<readonly number[]>([]);
  const [loaded, setLoaded] = useState<readonly number[]>([]);
  // Until its first frame is on screen the canvas stays clear over the world's sky, so a slow
  // phone sees sky where an opaque canvas would show black.
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--color-island-sky-high),var(--color-island-sky-low))]"
    >
      <canvas
        aria-hidden="true"
        className="block size-full opacity-0 [image-rendering:pixelated] data-[drawn=true]:opacity-100"
        data-revision={loaded.length}
        data-testid="island-view"
        ref={(canvas) => {
          if (canvas === null) {
            return;
          }
          return Option.match(createPainter(canvas, seasonNow()), {
            onNone: () => undefined,
            onSome: (painter) => {
              const shown = preview(
                canvas,
                painter,
                world.land,
                world.home,
                () => Number(canvas.dataset.revision)
              );
              setWanted(shown.regions);
              return shown.stop;
            },
          });
        }}
        tabIndex={-1}
      />
      <IslandRegions
        land={world.land}
        loaded={loaded}
        onArrive={(region) => setLoaded((held) => Arr.append(held, region))}
        username={null}
        wanted={wanted}
      />
    </div>
  );
}

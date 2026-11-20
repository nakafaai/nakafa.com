"use client";

import type { Edit } from "@repo/backend/confect/island/world";
import { createFramePace } from "@repo/design-system/lib/pace";
import { Array as Arr, DateTime, Option } from "effect";
import type { Painter } from "@/components/island/draw";
import { createPainter } from "@/components/island/draw";
import { flatQuads } from "@/lib/island/flat";
import { islesMesh } from "@/lib/island/isles";
import { glowOf } from "@/lib/island/light";
import { lightingOf, meshChunk } from "@/lib/island/mesh";
import { portraitOf } from "@/lib/island/portrait";
import { livedOf, sceneBodies, sceneOf } from "@/lib/island/scene";
import { seasonNow } from "@/lib/island/season";
import { hourOf, lightOf } from "@/lib/island/sky";
import { worldOf } from "@/lib/island/terrain";
import { CHUNKS } from "@/lib/island/world";

/**
 * Draws the world into one canvas from a still camera, its water and its life
 * moving, until the returned cleanup stops it: the same living scene as the
 * game (ADR 0047, D53), its archipelago round it, its herd and villagers
 * wandering, the day's wild visitors, the sea's swimmers and the reef, framed
 * whole with its shore (D55). The camera never turns by itself: the learner
 * turns the world once they enter the game.
 */
function preview(
  canvas: HTMLCanvasElement,
  painter: Painter,
  world: Uint8Array,
  { seed, size }: { seed: number; size: number }
) {
  const lighting = lightingOf(world, glowOf(world));
  let scene = sceneOf(
    world,
    seed,
    size,
    Math.floor(DateTime.toEpochMillis(DateTime.nowUnsafe()) / 86_400_000)
  );
  painter.isles(islesMesh(seed));
  painter.world(world, seed);
  Arr.forEach(
    Arr.makeBy(CHUNKS * CHUNKS, (index) => index),
    (index) => {
      painter.upload(
        index,
        meshChunk(world, lighting, index % CHUNKS, Math.floor(index / CHUNKS))
      );
    }
  );
  let frame = 0;
  let lastLife = 0;
  let orbit = portraitOf(size, 1);
  // A canvas drawn before its size is known, or cleared by a new size, shows black until it is
  // drawn again, so the frame after a resize draws whatever the pace says.
  let fresh = true;
  // A preview's water and life move by themselves, so they keep to its share of the thread (ADR 0039,
  // D5) and rests while hidden or scrolled away (ADR 0047, D26).
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
    const dt = lastLife === 0 ? 0 : Math.min(0.25, (now - lastLife) / 1000);
    lastLife = now;
    // The island's hour, which lights the world and keeps the villagers' day (D54).
    const hour = hourOf(DateTime.nowUnsafe(), DateTime.zoneMakeLocal());
    scene = livedOf(scene, dt, hour);
    painter.bodies(sceneBodies(scene, now / 1000, hour));
    painter.herd(flatQuads(size, now / 1000));
    painter.draw(
      orbit,
      lightOf(hour, "clear"),
      now / 1000,
      "clear",
      Option.none()
    );
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
    orbit = portraitOf(
      size,
      canvas.clientWidth / Math.max(1, canvas.clientHeight)
    );
  });
  resize.observe(canvas);
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    sight.disconnect();
    painter.release();
  };
}

/**
 * The learner's island as the home page shows it (ADR 0047): the same world
 * and renderer as the game, seen from a still camera, with no
 * HUD and no input. Its code loads once the reader is on the page.
 */
export default function IslandView({
  edits,
  seed,
  size,
}: {
  edits: readonly Edit[];
  seed: number;
  size: number;
}) {
  // Until its first frame is on screen the canvas stays clear over the island's sky, so a slow
  // phone sees sky where an opaque canvas would show black.
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--color-island-sky-high),var(--color-island-sky-low))]"
    >
      <canvas
        aria-hidden="true"
        className="block size-full opacity-0 [image-rendering:pixelated] data-[drawn=true]:opacity-100"
        data-testid="island-view"
        ref={(canvas) => {
          if (canvas === null) {
            return;
          }
          return Option.match(createPainter(canvas, seasonNow()), {
            onNone: () => undefined,
            onSome: (painter) =>
              preview(canvas, painter, worldOf(seed, size, edits), {
                seed,
                size,
              }),
          });
        }}
        tabIndex={-1}
      />
    </div>
  );
}

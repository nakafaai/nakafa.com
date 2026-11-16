"use client";

import type { Edit } from "@repo/backend/confect/island/world";
import { createFramePace } from "@repo/design-system/lib/pace";
import { Array as Arr, DateTime, Option } from "effect";
import { createPainter, type Painter } from "@/components/island/draw";
import { bodiesOf } from "@/lib/island/bodies";
import { openingOrbit, turnOrbit } from "@/lib/island/camera";
import { flatQuads } from "@/lib/island/life";
import { glowOf } from "@/lib/island/light";
import { lightingOf, meshChunk } from "@/lib/island/mesh";
import { plantBodies } from "@/lib/island/plants";
import { seasonNow } from "@/lib/island/season";
import { hourOf, lightOf } from "@/lib/island/sky";
import { worldOf } from "@/lib/island/terrain";
import { CHUNKS } from "@/lib/island/world";

/** How fast the camera circles the island on the home page, in radians a second. */
const TOUR = 0.06;

/** Draws the world into one canvas while the camera slowly circles it, until the returned cleanup stops it. */
function tour(
  canvas: HTMLCanvasElement,
  painter: Painter,
  world: Uint8Array,
  size: number
) {
  const lighting = lightingOf(world, glowOf(world));
  const plants = plantBodies(world);
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
  let last = 0;
  let orbit = openingOrbit(size, 1);
  // A canvas drawn before its size is known, or cleared by a new size, shows black until it is
  // drawn again, so the frame after a resize draws whatever the pace says.
  let fresh = true;
  // A tour runs by itself, so it keeps to its share of the thread (ADR 0039,
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
    // A tour back in sight goes on from where it stopped rather than jumping.
    const seconds = last === 0 ? 0 : Math.min(0.25, (now - last) / 1000);
    orbit = turnOrbit(orbit, seconds * TOUR);
    last = now;
    painter.bodies([...bodiesOf(world, [], now / 1000), ...plants]);
    painter.herd(flatQuads(size, now / 1000));
    const hour = hourOf(DateTime.nowUnsafe(), DateTime.zoneMakeLocal());
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
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    fresh = true;
    orbit = {
      ...openingOrbit(
        size,
        canvas.clientWidth / Math.max(1, canvas.clientHeight)
      ),
      yaw: orbit.yaw,
    };
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
 * and renderer as the game, seen from a camera that slowly circles it, with no
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
              tour(canvas, painter, worldOf(seed, size, edits), size),
          });
        }}
        tabIndex={-1}
      />
    </div>
  );
}

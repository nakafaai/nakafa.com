import { expect, type Locator, type Page } from "@playwright/test";
import { Duration, Effect } from "effect";

const VISUAL_ASSERTION_TIMEOUT = 5000;
const REQUIRED_STABLE_SAMPLES = 2;
/** A paused canvas clears no frame for this long. */
const QUIET_WINDOW_MILLISECONDS = 1000;
const QUIET_WINDOW_ATTEMPTS = 5;
/** One rotation drag, in pixels. */
const ORBIT_DRAG = { x: 96, y: -32 };

/** Waits until consecutive screenshots of one rendered canvas match. */
export const waitForStableCanvas = Effect.fn("NakafaE2E.waitForStableCanvas")(
  function* (canvas: Locator) {
    let previousFrame = yield* Effect.promise(() => canvas.screenshot());
    let stableSamples = 0;

    yield* Effect.promise(() =>
      expect
        .poll(
          async () => {
            const currentFrame = await canvas.screenshot();

            if (currentFrame.equals(previousFrame)) {
              stableSamples += 1;
            } else {
              stableSamples = 0;
            }

            previousFrame = currentFrame;
            return stableSamples;
          },
          {
            intervals: [100, 200, 300],
            timeout: VISUAL_ASSERTION_TIMEOUT,
          }
        )
        .toBeGreaterThanOrEqual(REQUIRED_STABLE_SAMPLES)
    );
  }
);

/** Waits until a canvas renders a frame that differs from the baseline. */
export const expectCanvasToMove = Effect.fn("NakafaE2E.expectCanvasToMove")(
  function* (canvas: Locator, baseline: Uint8Array) {
    yield* Effect.promise(() =>
      expect
        .poll(
          async () => {
            const currentFrame = await canvas.screenshot();
            return currentFrame.equals(baseline);
          },
          {
            intervals: [50, 100, 200],
            timeout: VISUAL_ASSERTION_TIMEOUT,
          }
        )
        .toBe(false)
    );
  }
);

/**
 * One WebGL method a page patch wraps on both contexts, and what each call
 * records: a `frame` counts the call on the canvas it draws to, and a `stack`
 * appends the call's stack to the page global `key`.
 */
type WebGLPatch =
  | { readonly method: "clear"; readonly record: "frame" }
  | {
      readonly key: string;
      readonly method: "readPixels";
      readonly record: "stack";
    };

/**
 * Wraps one WebGL method on both contexts, so each call records itself before
 * the browser runs the method. It runs in the page and cannot reach this
 * module, so it takes its patch as data. Pass it to `page.addInitScript` with
 * a `WebGLPatch` before the page creates its contexts.
 */
export function patchWebGL(patch: WebGLPatch) {
  const stacks: string[] = [];
  if (patch.record === "stack") {
    Reflect.set(window, patch.key, stacks);
  }
  for (const { prototype } of [WebGLRenderingContext, WebGL2RenderingContext]) {
    const original = prototype[patch.method];
    Object.defineProperty(prototype, patch.method, {
      configurable: true,
      value(
        this: WebGLRenderingContext | WebGL2RenderingContext,
        ...args: unknown[]
      ) {
        if (patch.record === "frame") {
          if (this.canvas instanceof HTMLCanvasElement) {
            const frames = Number(this.canvas.dataset.frames ?? 0);
            this.canvas.dataset.frames = String(frames + 1);
          }
        } else {
          const message = `WebGL ${patch.method} from a page script`;
          stacks.push(new Error(message).stack ?? message);
        }
        return Reflect.apply(original, this, args);
      },
      writable: true,
    });
  }
}

/** Counts the frames each WebGL canvas clears, as `data-frames` on the canvas. */
export const countCanvasFrames = {
  method: "clear",
  record: "frame",
} as const satisfies WebGLPatch;

/** The page global that collects page-script pixel readbacks. */
export const PIXEL_READBACKS = "nakafaPixelReadbacks";

/**
 * Records where each page-script pixel readback came from, which the
 * headless shell's own ReadPixels notice would otherwise hide.
 */
export const recordPixelReadbacks = {
  key: PIXEL_READBACKS,
  method: "readPixels",
  record: "stack",
} as const satisfies WebGLPatch;

/** Reads a canvas frame count without scrolling the canvas into view. */
function readFrames(canvas: Locator) {
  return canvas.evaluate((element) =>
    Number(element.getAttribute("data-frames") ?? 0)
  );
}

/** Waits until a canvas clears more frames than it has so far. */
export const expectFramesToAdvance = Effect.fn(
  "NakafaE2E.expectFramesToAdvance"
)(function* (canvas: Locator) {
  const frames = yield* Effect.promise(() => readFrames(canvas));
  yield* Effect.promise(() =>
    expect.poll(() => readFrames(canvas)).toBeGreaterThan(frames)
  );
});

/** Waits until a canvas clears no frame through one whole quiet window. */
export const expectFramesToHold = Effect.fn("NakafaE2E.expectFramesToHold")(
  function* (canvas: Locator) {
    let cleared = Number.POSITIVE_INFINITY;
    // The pause lands once the observer reports, so allow a few windows.
    for (
      let attempt = 0;
      attempt < QUIET_WINDOW_ATTEMPTS && cleared > 0;
      attempt += 1
    ) {
      const before = yield* Effect.promise(() => readFrames(canvas));
      yield* Effect.sleep(Duration.millis(QUIET_WINDOW_MILLISECONDS));
      cleared = (yield* Effect.promise(() => readFrames(canvas))) - before;
    }
    yield* Effect.sync(() => expect(cleared).toBe(0));
  }
);

/** Reads a canvas's size on screen and the size of its drawing buffer. */
export function readCanvasSize(canvas: Locator) {
  return canvas.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return element instanceof HTMLCanvasElement
      ? {
          bufferHeight: element.height,
          bufferWidth: element.width,
          height: bounds.height,
          width: bounds.width,
        }
      : undefined;
  });
}

/**
 * Records on a canvas whether its drawing buffer changes size, as
 * `data-drawing-buffer-changed`, so a suite can read it after an interaction.
 */
export const observeDrawingBufferSize = Effect.fn(
  "NakafaE2E.observeDrawingBufferSize"
)(function* (canvas: Locator) {
  const started = yield* Effect.promise(() =>
    canvas.evaluate((element) => {
      if (!(element instanceof HTMLCanvasElement)) {
        return false;
      }

      const initialHeight = element.height;
      const initialWidth = element.width;
      element.dataset.drawingBufferChanged = "false";

      const observer = new MutationObserver(() => {
        if (
          element.height === initialHeight &&
          element.width === initialWidth
        ) {
          return;
        }

        element.dataset.drawingBufferChanged = "true";
        observer.disconnect();
      });
      observer.observe(element, {
        attributeFilter: ["height", "width"],
        attributes: true,
      });
      return true;
    })
  );

  yield* Effect.sync(() => expect(started).toBe(true));
});

/** A pointer position on the page, in CSS pixels. */
interface PagePoint {
  readonly x: number;
  readonly y: number;
}

/** Presses the mouse at `from`, drags it to `to` in six steps, and releases it. */
export const dragMouse = Effect.fn("NakafaE2E.dragMouse")(function* (
  page: Page,
  from: PagePoint,
  to: PagePoint
) {
  yield* Effect.promise(async () => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
  });
});

/**
 * Drags across the middle of a scene the way a learner rotates it. The drag
 * has one length at every size, so damping settles it as fast in full screen
 * as in the page.
 */
export const orbitCanvas = Effect.fn("NakafaE2E.orbitCanvas")(function* (
  page: Page,
  canvas: Locator
) {
  const bounds = yield* Effect.promise(() => canvas.boundingBox());
  yield* Effect.sync(() => expect(bounds).not.toBeNull());
  if (!bounds) {
    return;
  }
  const from = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  yield* dragMouse(page, from, {
    x: from.x + ORBIT_DRAG.x,
    y: from.y + ORBIT_DRAG.y,
  });
});

import type { Locator, Page } from "@playwright/test";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** How long nothing may change before a page counts as quiet. */
const QUIET_MILLISECONDS = 500;

/**
 * Waits until the page has gone quiet: for `QUIET_MILLISECONDS` no element was
 * added, removed or changed, no text changed, no resource finished loading, and
 * no finite animation ran. A page's late parts (sections, cards, Nina, a
 * weather card) render inside that, so a check of what moved or what drew
 * reads after every late part had its chance, on a fast run at once and on a
 * slow one as late as it needs. A change of an inline style alone does not
 * count, since a running decoration rewrites one on every frame and moves no
 * layout; nor does a change inside a drawing (an SVG, such as Nina, whose live
 * pose rewrites its paths on every frame), inside a part hidden from assistive
 * technology (decoration, such as letters a heading types and deletes in a loop),
 * or on a toy, which rests and wakes in the layer that floats over the page;
 * nor does an endless animation, such as a spinner, or one that the scroll
 * drives, such as a part rising into view, which stays "running" as long as the
 * page can scroll and never ends by itself. A page that never
 * goes quiet is read after `readinessTimeoutMilliseconds`, as late as a fixed
 * wait of that length would have read it.
 */
export const waitForQuiet = (page: Page) =>
  page.evaluate(
    ({ limit, quiet }) =>
      new Promise<void>((resolve) => {
        const start = performance.now();
        let last = start;
        const touch = () => {
          last = performance.now();
        };
        // A record counts when it changes the page, not a drawing or decoration that runs by itself.
        const counts = (record: MutationRecord) => {
          const node = record.target;
          const element =
            node instanceof Element ? node : (node.parentElement ?? null);
          return !(
            record.attributeName === "style" ||
            element?.closest("svg, [aria-hidden='true'], [data-toy]")
          );
        };
        const mutations = new MutationObserver((records) => {
          if (records.some(counts)) {
            touch();
          }
        });
        mutations.observe(document, {
          attributes: true,
          characterData: true,
          childList: true,
          subtree: true,
        });
        const resources = new PerformanceObserver(touch);
        resources.observe({ type: "resource" });
        const check = () => {
          const now = performance.now();
          const animating = document
            .getAnimations()
            .some(
              (animation) =>
                animation.playState === "running" &&
                animation.timeline === document.timeline &&
                animation.effect?.getComputedTiming().iterations !==
                  Number.POSITIVE_INFINITY
            );
          if (animating) {
            touch();
          }
          if (now - last >= quiet || now - start >= limit) {
            mutations.disconnect();
            resources.disconnect();
            resolve();
            return;
          }
          requestAnimationFrame(check);
        };
        check();
      }),
    { limit: readinessTimeoutMilliseconds, quiet: QUIET_MILLISECONDS }
  );

/**
 * Waits until every finite animation and transition of the element and its
 * contents has finished, such as a hover's color change or a panel that folds.
 * It reads them after the next frame, when a change that the last input
 * started has begun; an endless one, such as a spinner, never finishes and is
 * left out.
 */
export const waitForAnimations = (locator: Locator) =>
  locator.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          Promise.allSettled(
            element
              .getAnimations({ subtree: true })
              .filter(
                (animation) =>
                  animation.effect?.getComputedTiming().iterations !==
                  Number.POSITIVE_INFINITY
              )
              .map((animation) => animation.finished)
          ).then(() => resolve());
        });
      })
  );

/** Frames in a row that a still thing must hold its place for. */
const STILL_FRAMES = 3;

/**
 * Waits until the element holds its place on the screen for `STILL_FRAMES`
 * frames in a row, such as a drawer that slides up as it opens, whatever moves
 * it: a transition, a spring, or a scroll.
 */
export const waitForStill = (locator: Locator) =>
  locator.evaluate(
    (element, frames) =>
      new Promise<void>((resolve) => {
        let last = Number.NaN;
        let held = 0;
        const look = () => {
          const top = element.getBoundingClientRect().top;
          held = top === last ? held + 1 : 0;
          last = top;
          if (held >= frames) {
            resolve();
            return;
          }
          requestAnimationFrame(look);
        };
        requestAnimationFrame(look);
      }),
    STILL_FRAMES
  );

/**
 * Waits until the page's scroll comes to rest: the same scroll position for
 * `STILL_FRAMES` frames in a row, such as the landing of a smooth scroll to an
 * anchor.
 */
export const waitForScrollRest = (page: Page) =>
  page.evaluate(
    (frames) =>
      new Promise<void>((resolve) => {
        let last = Number.NaN;
        let held = 0;
        const look = () => {
          held = window.scrollY === last ? held + 1 : 0;
          last = window.scrollY;
          if (held >= frames) {
            resolve();
            return;
          }
          requestAnimationFrame(look);
        };
        requestAnimationFrame(look);
      }),
    STILL_FRAMES
  );

/**
 * Waits for `count` frames the page draws, for a check that something holds
 * still across frames: a loaded machine draws fewer frames a second, and a
 * count of frames still gives the page that many chances to move it.
 */
export const waitForFrames = (page: Page, count: number) =>
  page.evaluate(
    (frames) =>
      new Promise<void>((resolve) => {
        let left = frames;
        const next = () => {
          left -= 1;
          if (left <= 0) {
            resolve();
            return;
          }
          requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      }),
    count
  );

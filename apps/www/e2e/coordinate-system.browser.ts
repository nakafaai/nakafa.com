import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { THREE_DIAGRAM_MINIMUM_FONT_SIZE } from "@repo/design-system/components/three/data/constants";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Effect, Schema } from "effect";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";

const LINEAR_SYSTEM_ROUTE =
  "/id/materi/matematika/sistem-persamaan-dan-pertidaksamaan-linear/sistem-persamaan-linear";
const MANY_SOLUTIONS_TITLE = "Sistem Persamaan Linear dengan Banyak Solusi";
const TRIANGLE_ROUTE =
  "/en/subjects/mathematics/trigonometry/right-triangle-naming";
const UNIT_CIRCLE_ROUTE =
  "/en/subjects/mathematics/trigonometry/trigonometry-concept";
const VISUAL_ASSERTION_TIMEOUT = 5000;
const REQUIRED_STABLE_SAMPLES = 2;
const HYPOTENUSE_LABEL = /^c$/;

const waitForStableCanvas = Effect.fn("NakafaE2E.waitForStableCanvas")(
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

const expectCanvasToMove = Effect.fn("NakafaE2E.expectCanvasToMove")(function* (
  canvas: Locator,
  baseline: Uint8Array
) {
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
});

const observeDrawingBufferSize = Effect.fn(
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

const orbitScene = Effect.fn("NakafaE2E.orbitScene")(function* (
  page: Page,
  canvas: Locator
) {
  const bounds = yield* Effect.promise(() => canvas.boundingBox());
  yield* Effect.sync(() => expect(bounds).not.toBeNull());
  if (!bounds) {
    return;
  }

  const startX = bounds.x + bounds.width * 0.4;
  const startY = bounds.y + bounds.height * 0.55;
  const endX = bounds.x + bounds.width * 0.7;
  const endY = bounds.y + bounds.height * 0.4;

  yield* Effect.promise(() => page.mouse.move(startX, startY));
  yield* Effect.promise(() => page.mouse.down());
  yield* Effect.promise(() =>
    page.mouse.move(endX, endY, {
      steps: 6,
    })
  );
  yield* Effect.promise(() => page.mouse.up());
});

const zoomScene = Effect.fn("NakafaE2E.zoomScene")(function* (
  page: Page,
  canvas: Locator,
  deltaY: number,
  steps = 12
) {
  yield* Effect.promise(() => canvas.hover());
  for (let step = 0; step < steps; step += 1) {
    yield* Effect.promise(() => page.mouse.wheel(0, deltaY));
  }
  yield* waitForStableCanvas(canvas);
});

const expectReadableLabel = Effect.fn("NakafaE2E.expectReadableLabel")(
  function* (label: Locator) {
    const fontSize = yield* Effect.promise(() =>
      label.evaluate((element) => {
        let scale = 1;
        for (
          let node: Element | null = element;
          node && node.getAttribute("data-slot") !== "coordinate-system";
          node = node.parentElement
        ) {
          const style = getComputedStyle(node);
          const matrix = new DOMMatrixReadOnly(style.transform);
          const localScale =
            style.scale === "none" ? 1 : Number.parseFloat(style.scale);
          scale *= Math.hypot(matrix.a, matrix.b) * localScale;
        }
        return Number.parseFloat(getComputedStyle(element).fontSize) * scale;
      })
    );
    yield* Effect.sync(() =>
      expect(fontSize).toBeGreaterThanOrEqual(
        THREE_DIAGRAM_MINIMUM_FONT_SIZE - 0.01
      )
    );
  }
);

const expectBoundedTriangleZoom = Effect.fn(
  "NakafaE2E.expectBoundedTriangleZoom"
)(function* (page: Page) {
  yield* seedDeniedAnalyticsConsent(page);
  const response = yield* Effect.promise(() =>
    page.goto(TRIANGLE_ROUTE, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  const scene = page.locator('[data-slot="triangle-scene"]');
  const card = page.locator('[data-slot="card"]').filter({ has: scene });
  const canvas = scene.locator("canvas");
  const label = scene
    .locator(".katex-html")
    .filter({ hasText: HYPOTENUSE_LABEL });
  // Reveal the content-visibility card before scrolling its deferred scene.
  yield* Effect.promise(() =>
    expect(async () => {
      await card.scrollIntoViewIfNeeded();
      await expect(scene).toBeVisible();
      await scene.scrollIntoViewIfNeeded();
      expect(await canvas.isVisible()).toBe(true);
    }).toPass({ timeout: 30_000 })
  );
  yield* Effect.promise(() => expect(label).toBeVisible());
  yield* Effect.promise(() =>
    expect(card.locator("[data-coordinate-controls]")).toContainText(
      "Hypotenuse"
    )
  );
  yield* waitForStableCanvas(canvas);
  yield* expectReadableLabel(label);

  yield* zoomScene(page, canvas, 240);
  yield* expectReadableLabel(label);
  const atLimit = yield* Effect.promise(() => canvas.screenshot());
  yield* zoomScene(page, canvas, 240);
  const afterMoreZoom = yield* Effect.promise(() => canvas.screenshot());
  yield* Effect.sync(() => expect(afterMoreZoom.equals(atLimit)).toBe(true));

  yield* zoomScene(page, canvas, -240, 1);
  yield* expectCanvasToMove(canvas, atLimit);
  yield* expectReadableLabel(label);
  const beforeOrbit = yield* Effect.promise(() => canvas.screenshot());
  yield* orbitScene(page, canvas);
  yield* expectCanvasToMove(canvas, beforeOrbit);
});

const expectStableCoordinateSystem = Effect.fn(
  "NakafaE2E.expectStableCoordinateSystem"
)(function* (page: Page) {
  yield* seedDeniedAnalyticsConsent(page);
  const response = yield* Effect.promise(() =>
    page.goto(LINEAR_SYSTEM_ROUTE, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));

  const card = page.locator('[data-slot="card"]').filter({
    hasText: MANY_SOLUTIONS_TITLE,
  });
  const scene = card.locator('[data-slot="line-scene"]');
  const canvas = scene.locator("canvas");
  const footer = card.locator("[data-coordinate-controls]");
  const gridButton = footer.getByRole("button", { name: "Kisi" });
  const rotationButton = footer.getByRole("button", {
    name: "Rotasi otomatis",
  });

  yield* Effect.promise(() =>
    expect(async () => {
      await expect(card).toHaveCount(1);
      await expect(scene).toBeAttached();
      await card.scrollIntoViewIfNeeded();
      await scene.scrollIntoViewIfNeeded();
      expect(await canvas.isVisible()).toBe(true);
    }).toPass({ timeout: 30_000 })
  );
  yield* Effect.promise(() =>
    expect(gridButton).toHaveAttribute("aria-pressed", "true")
  );
  yield* Effect.promise(() =>
    expect(rotationButton).toHaveAttribute("aria-pressed", "false")
  );
  yield* Effect.promise(() => gridButton.click());
  yield* Effect.promise(() =>
    expect(gridButton).toHaveAttribute("aria-pressed", "false")
  );
  yield* Effect.promise(() => gridButton.click());
  yield* Effect.promise(() =>
    expect(gridButton).toHaveAttribute("aria-pressed", "true")
  );
  yield* waitForStableCanvas(canvas);
  yield* observeDrawingBufferSize(canvas);

  const beforePlay = yield* Effect.promise(() => canvas.screenshot());
  yield* Effect.promise(() => rotationButton.click());
  yield* Effect.promise(() =>
    expect(rotationButton).toHaveAttribute("aria-pressed", "true")
  );
  yield* expectCanvasToMove(canvas, beforePlay);
  yield* Effect.promise(() => rotationButton.click());
  yield* Effect.promise(() =>
    expect(rotationButton).toHaveAttribute("aria-pressed", "false")
  );
  yield* waitForStableCanvas(canvas);

  const beforeDrag = yield* Effect.promise(() => canvas.screenshot());
  yield* orbitScene(page, canvas);
  yield* expectCanvasToMove(canvas, beforeDrag);
  yield* Effect.promise(() =>
    expect(canvas).toHaveAttribute("data-drawing-buffer-changed", "false")
  );
});

test("coordinate-system interaction keeps its drawing buffer stable", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        serviceWorkers: "block",
        viewport: { height: 800, width: 1200 },
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            expectStableCoordinateSystem(page)
          );
        })
    )
  );
});

for (const width of [390, 1200]) {
  test(`triangle zoom remains readable and interactive at ${width}px`, async ({
    baseURL,
    browser,
  }) => {
    expect(baseURL).toBeTruthy();
    await Effect.runPromise(
      withBrowserContext(
        browser,
        {
          baseURL: baseURL ?? "",
          serviceWorkers: "block",
          viewport: { height: 844, width },
        },
        (context) =>
          Effect.gen(function* () {
            const page = yield* Effect.promise(() => context.newPage());
            yield* withObservedPageErrors(
              page,
              expectBoundedTriangleZoom(page)
            );
          })
      )
    );
  });
}

/** Proves one published unit-circle angle field stays finite and exact. */
const verifyUnitCircleEditing = Effect.fn("NakafaE2E.verifyUnitCircleEditing")(
  function* (card: Locator, angle: Locator, locale: AppLocaleCode) {
    const formatter = new Intl.NumberFormat(locale);
    const ratioFormatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      useGrouping: false,
    });
    const annotations = card.locator(
      '[data-coordinate-controls] annotation[encoding="application/x-tex"]'
    );
    for (const value of [31.5, -30.5, 390.5]) {
      const formatted = formatter.format(value);
      const radians = (value * Math.PI) / 180;
      const expected = [
        `\\sin\\theta \\approx ${ratioFormatter.format(Math.sin(radians)).replaceAll(",", "{,}")}`,
        `\\cos\\theta \\approx ${ratioFormatter.format(Math.cos(radians)).replaceAll(",", "{,}")}`,
        `\\tan\\theta \\approx ${ratioFormatter.format(Math.tan(radians)).replaceAll(",", "{,}")}`,
        `\\theta = ${value}^\\circ`,
      ];
      for (const input of [formatted, ""]) {
        yield* Effect.promise(() => angle.fill(input));
        yield* Effect.promise(() => angle.press("Tab"));
        yield* Effect.promise(() => expect(angle).toHaveValue(formatted));
        yield* Effect.promise(() => expect(card).not.toContainText("NaN"));
        yield* Effect.promise(() => expect(annotations).toHaveText(expected));
      }
    }
  }
);

test("published unit-circle controls preserve finite angles after clearing", async ({
  page,
}) => {
  const { APP_LOCALE_CODES } = await import("@nakafa/aksara-contracts/locale");
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedDeniedAnalyticsConsent(page);
        const response = yield* Effect.promise(() =>
          page.goto(UNIT_CIRCLE_ROUTE, { waitUntil: "domcontentloaded" })
        );
        yield* Effect.sync(() => expect(response?.status()).toBe(200));
      })
    )
  );
  for (const locale of APP_LOCALE_CODES) {
    await test.step(locale, () =>
      Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.gen(function* () {
            const messages = yield* Effect.promise(() =>
              loadLocaleMessages(locale)
            );
            const alternate = page.locator(
              `link[rel="alternate"][hreflang="${locale}"]`
            );
            yield* Effect.promise(() => expect(alternate).toHaveCount(1));
            const href = yield* Effect.promise(() =>
              alternate.getAttribute("href")
            );
            const localized = yield* Schema.decodeUnknownEffect(
              Schema.URLFromString
            )(href);
            const response = yield* Effect.promise(() =>
              page.goto(localized.pathname, { waitUntil: "domcontentloaded" })
            );
            yield* Effect.sync(() => expect(response?.status()).toBe(200));
            const article = page.locator("article");
            const angles = article.getByRole("textbox", {
              exact: true,
              name: messages.Common.angle,
            });
            // This signed lesson teaches the triangle before the unit circle.
            const angle = angles.last();
            const circle = article
              .locator('[data-slot="card"]')
              .filter({
                has: page.getByRole("textbox", {
                  exact: true,
                  name: messages.Common.angle,
                }),
              })
              .last();
            // Reveal the deferred card after hydration before editing; the
            // client render replaces the pre-hydration node, so the reveal
            // must be retried until the unit-circle field is live.
            yield* Effect.promise(() =>
              expect(async () => {
                await expect(angles).toHaveCount(2);
                await expect(circle).toHaveCount(1);
                await angle.scrollIntoViewIfNeeded();
                await expect(angle).toBeVisible();
                await expect(angle).toHaveValue("30");
              }).toPass({ timeout: 30_000 })
            );
            yield* verifyUnitCircleEditing(circle, angle, locale);
          })
        )
      )
    );
  }
});

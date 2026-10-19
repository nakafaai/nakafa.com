import { expect, type Page } from "@playwright/test";
import { Effect, Schema } from "effect";

const PricingRectSchema = Schema.Struct({
  height: Schema.Finite,
  width: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
});

type PricingRect = typeof PricingRectSchema.Type;

const PricingGeometrySchema = Schema.Struct({
  plans: Schema.Record(Schema.String, PricingRectSchema),
  slots: Schema.Record(Schema.String, PricingRectSchema),
});

type PricingGeometry = typeof PricingGeometrySchema.Type;

// The page's observer writes these fields in place, so they stay mutable.
const PricingTransitionObservationSchema = Schema.Struct({
  after: Schema.mutableKey(Schema.NullOr(PricingGeometrySchema)),
  before: Schema.mutableKey(Schema.NullOr(PricingGeometrySchema)),
  layoutShift: Schema.mutableKey(Schema.Finite),
});

type PricingTransitionObservation =
  typeof PricingTransitionObservationSchema.Type;

declare global {
  interface Window {
    __nakafaPricingTransition?: PricingTransitionObservation;
  }
}

function countOccurrences(value: string, pattern: string) {
  return value.split(pattern).length - 1;
}

/**
 * Proves the static HTML carries every currency of both plans and of the
 * comparisons, so no price waits on a request. Each currency is marked once per
 * plan slot and once in the comparisons.
 */
export const expectStablePricingAppShell = Effect.fn(
  "NakafaE2E.expectStablePricingAppShell"
)(function* (page: Page) {
  const response = yield* Effect.promise(() =>
    page.request.get("/id/pricing", {
      headers: { Accept: "text/html" },
    })
  );
  const html = yield* Effect.promise(() => response.text());

  yield* Effect.sync(() => {
    expect(response.ok()).toBe(true);
    expect(countOccurrences(html, "data-pricing-plan=")).toBe(2);
    expect(countOccurrences(html, "data-pricing-price-slot=")).toBe(2);
    for (const currency of ["IDR", "EUR", "USD"]) {
      expect(countOccurrences(html, `data-price-currency="${currency}"`)).toBe(
        3
      );
    }
  });
});

/**
 * Records the plan geometry on the first paint of the document and after the
 * page has loaded, and sums the layout shifts between the two. The currency
 * mark is set before the prices are parsed, so the two geometries must agree.
 */
const installPricingTransitionObserver = Effect.fn(
  "NakafaE2E.installPricingTransitionObserver"
)(function* (page: Page) {
  yield* Effect.promise(() =>
    page.addInitScript(() => {
      const observation: PricingTransitionObservation = {
        after: null,
        before: null,
        layoutShift: 0,
      };
      window.__nakafaPricingTransition = observation;

      const readRect = (element: Element): PricingRect => {
        const rect = element.getBoundingClientRect();
        return {
          height: rect.height,
          width: rect.width,
          x: rect.x,
          y: rect.y,
        };
      };
      const readGeometry = (): PricingGeometry => ({
        plans: Object.fromEntries(
          [...document.querySelectorAll("[data-pricing-plan]")].map(
            (element) => [
              element.getAttribute("data-pricing-plan") ?? "",
              readRect(element),
            ]
          )
        ),
        slots: Object.fromEntries(
          [...document.querySelectorAll("[data-pricing-price-slot]")].map(
            (element) => [
              element.getAttribute("data-pricing-price-slot") ?? "",
              readRect(element),
            ]
          )
        ),
      });
      const addLayoutShifts = (entries: PerformanceEntry[]) => {
        for (const entry of entries) {
          if ("value" in entry && typeof entry.value === "number") {
            observation.layoutShift += entry.value;
          }
        }
      };
      const layoutShiftObserver = new PerformanceObserver((list) =>
        addLayoutShifts(list.getEntries())
      );
      layoutShiftObserver.observe({ buffered: true, type: "layout-shift" });

      document.addEventListener(
        "DOMContentLoaded",
        () => {
          requestAnimationFrame(() => {
            observation.before = readGeometry();
          });
        },
        { once: true }
      );
      window.addEventListener(
        "load",
        () => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              addLayoutShifts(layoutShiftObserver.takeRecords());
              layoutShiftObserver.disconnect();
              observation.after = readGeometry();
            })
          );
        },
        { once: true }
      );
    })
  );
});

/** Reloads pricing from its document shell and reads its settled geometry. */
export const observeStablePricingReload = Effect.fn(
  "NakafaE2E.observeStablePricingReload"
)(function* (page: Page, readinessTimeoutMilliseconds: number) {
  yield* installPricingTransitionObserver(page);
  const response = yield* Effect.promise(() =>
    page.reload({ waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  yield* Effect.promise(() =>
    page.waitForFunction(
      () => Boolean(window.__nakafaPricingTransition?.after),
      undefined,
      { timeout: readinessTimeoutMilliseconds }
    )
  );
  const observation = yield* Effect.promise(() =>
    page.evaluate(() => window.__nakafaPricingTransition)
  );
  yield* Effect.sync(() => expect(observation).toBeDefined());
  return observation;
});

/** Asserts that the first paint and the settled page place every plan in the same box. */
export function expectStablePricingTransition(
  observation: PricingTransitionObservation | undefined
) {
  expect(observation).toBeDefined();
  if (!observation) {
    return;
  }

  expect(observation.before).not.toBeNull();
  expect(observation.after).not.toBeNull();
  expect(observation.layoutShift).toBe(0);
  if (!(observation.after && observation.before)) {
    return;
  }

  for (const plan of ["free", "pro"] as const) {
    expect(observation.after.plans[plan]).toEqual(
      observation.before.plans[plan]
    );
    expect(observation.after.slots[plan].height).toBe(
      observation.before.slots[plan].height
    );
    expect(observation.after.slots[plan].y).toBe(
      observation.before.slots[plan].y
    );
  }
}

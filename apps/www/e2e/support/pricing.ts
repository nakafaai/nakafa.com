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
  layoutShift: Schema.mutableKey(Schema.Finite),
});

type PricingTransitionObservation =
  typeof PricingTransitionObservationSchema.Type;

declare global {
  interface Window {
    __pricingTransition?: PricingTransitionObservation;
  }
}

function countOccurrences(value: string, pattern: string) {
  return value.split(pattern).length - 1;
}

/** Proves the static HTML holds both plans and both price slots, each price already written as text. */
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
  });
});

/** Installs an observer before a cold document load begins parsing. */
const installPricingTransitionObserver = Effect.fn(
  "NakafaE2E.installPricingTransitionObserver"
)(function* (page: Page) {
  yield* Effect.promise(() =>
    page.addInitScript(() => {
      const observation: PricingTransitionObservation = {
        after: null,
        layoutShift: 0,
      };
      window.__pricingTransition = observation;

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
      let finishing = false;

      const finish = () => {
        if (finishing) {
          return;
        }
        finishing = true;

        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            addLayoutShifts(layoutShiftObserver.takeRecords());
            layoutShiftObserver.disconnect();
            mutationObserver.disconnect();
            observation.after = readGeometry();
          })
        );
      };

      const mutationObserver = new MutationObserver(() => {
        if (document.querySelectorAll("[data-pricing-plan]").length === 2) {
          finish();
        }
      });

      mutationObserver.observe(document, { childList: true, subtree: true });
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
      () => Boolean(window.__pricingTransition?.after),
      undefined,
      { timeout: readinessTimeoutMilliseconds }
    )
  );
  const observation = yield* Effect.promise(() =>
    page.evaluate(() => window.__pricingTransition)
  );
  yield* Effect.sync(() => expect(observation).toBeDefined());
  return observation;
});

/** Asserts that the reloaded page laid out both plans without a layout shift. */
export function expectStablePricingTransition(
  observation: PricingTransitionObservation | undefined
) {
  expect(observation).toBeDefined();
  expect(observation?.after).not.toBeNull();
  expect(observation?.layoutShift).toBe(0);
}

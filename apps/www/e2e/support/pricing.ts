import { expect, type Page } from "@playwright/test";

interface PricingRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface PricingGeometry {
  plans: Record<string, PricingRect>;
  slots: Record<string, PricingRect>;
}

interface PricingTransitionObservation {
  after: PricingGeometry | null;
  before: PricingGeometry | null;
  layoutShift: number;
}

declare global {
  interface Window {
    __nakafaPricingTransition?: PricingTransitionObservation;
  }
}

function countOccurrences(value: string, pattern: string) {
  return value.split(pattern).length - 1;
}

/** Proves the streamed HTML keeps both plans around price-only fallbacks. */
export async function expectStablePricingAppShell(page: Page) {
  const response = await page.request.get("/id/pricing", {
    headers: { Accept: "text/html" },
  });
  expect(response.ok()).toBe(true);

  const html = await response.text();
  expect(countOccurrences(html, "data-pricing-plan=")).toBe(2);
  expect(countOccurrences(html, "data-pricing-price-slot=")).toBe(2);
  expect(countOccurrences(html, 'data-pricing-price-fallback="true"')).toBe(2);
}

/** Installs an observer before a cold document load begins parsing. */
function installPricingTransitionObserver(page: Page) {
  return page.addInitScript(() => {
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
        [...document.querySelectorAll("[data-pricing-plan]")].map((element) => [
          element.getAttribute("data-pricing-plan") ?? "",
          readRect(element),
        ])
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
    let baselineScheduled = false;
    let finishing = false;

    const finish = () => {
      if (finishing) {
        return;
      }
      finishing = true;

      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const fallbackCount = document.querySelectorAll(
            "[data-pricing-price-fallback]"
          ).length;
          if (fallbackCount > 0) {
            finishing = false;
            return;
          }

          addLayoutShifts(layoutShiftObserver.takeRecords());
          layoutShiftObserver.disconnect();
          mutationObserver.disconnect();
          observation.after = readGeometry();
        })
      );
    };

    const scheduleBaseline = () => {
      if (baselineScheduled || observation.before) {
        return;
      }
      baselineScheduled = true;

      requestAnimationFrame(() => {
        baselineScheduled = false;
        const geometry = readGeometry();
        const renderedPlans = Object.values(geometry.plans);

        if (
          renderedPlans.length !== 2 ||
          renderedPlans.some((rect) => rect.height === 0 || rect.width === 0)
        ) {
          scheduleBaseline();
          return;
        }

        observation.before = geometry;
        layoutShiftObserver.observe({ type: "layout-shift" });

        if (
          document.querySelectorAll("[data-pricing-price-fallback]").length ===
          0
        ) {
          finish();
        }
      });
    };

    const mutationObserver = new MutationObserver(() => {
      const fallbackCount = document.querySelectorAll(
        "[data-pricing-price-fallback]"
      ).length;
      const planCount = document.querySelectorAll("[data-pricing-plan]").length;

      if (!observation.before && planCount === 2) {
        scheduleBaseline();
      }
      if (observation.before && fallbackCount === 0) {
        finish();
      }
    });

    mutationObserver.observe(document, { childList: true, subtree: true });
  });
}

/** Reloads pricing from its document shell and reads its settled geometry. */
export async function observeStablePricingReload(
  page: Page,
  readinessTimeoutMilliseconds: number
) {
  await installPricingTransitionObserver(page);
  const response = await page.reload({ waitUntil: "domcontentloaded" });
  expect(response?.ok()).toBe(true);
  await page.waitForFunction(
    () => Boolean(window.__nakafaPricingTransition?.after),
    undefined,
    { timeout: readinessTimeoutMilliseconds }
  );
  const observation = await page.evaluate(
    () => window.__nakafaPricingTransition
  );
  expect(observation).toBeDefined();
  return observation;
}

/** Asserts that localized price resolution preserved all plan geometry. */
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

  if (!(observation.before && observation.after)) {
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

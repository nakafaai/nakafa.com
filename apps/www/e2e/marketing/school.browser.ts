import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { loadMarketingPage } from "@/e2e/support/marketing";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { desktopViewport, touchViewport } from "@/e2e/support/viewport";

// The School prices show in the currency of the visitor's time zone, and these checks read the
// rupiah prices, so every test runs in a Jakarta zone, whatever zone the machine is in.
test.use({ timezoneId: "Asia/Jakarta" });

/** The name of the twelve-month period in Indonesian, which starts with its length. */
const TWELVE_MONTHS = /^12 bulan/u;

/** A rupiah price as the page writes it, with the no-break space after the symbol. */
const rupiah = (digits: string) => `Rp ${digits}`;

/** Whether the page scrolls sideways at the current width. */
const readOverflow = (page: Page) =>
  Effect.promise(() =>
    page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
  );

const verifySchoolLanding = Effect.fn("NakafaE2E.verifySchoolLanding")(
  function* (page: Page) {
    yield* loadMarketingPage(page, "/en/school");
    yield* Effect.promise(() =>
      expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Your whole school"
      )
    );
    yield* Effect.promise(() =>
      expect(
        page.locator("#hero").getByRole("link", { name: "Start free trial" })
      ).toHaveAttribute("href", "/en/school/new")
    );
    yield* Effect.promise(() =>
      expect(page.locator("[data-school-feature]")).toHaveCount(9)
    );
    yield* Effect.promise(() =>
      expect(page.locator('[data-school-plan="pro"]')).toContainText(
        rupiah("1.790.000")
      )
    );
    expect(yield* readOverflow(page)).toBeLessThanOrEqual(0);
  }
);

const verifySchoolPricing = Effect.fn("NakafaE2E.verifySchoolPricing")(
  function* (page: Page) {
    yield* loadMarketingPage(page, "/id/school/pricing");
    const max = page.locator('[data-school-plan="max"]');
    yield* Effect.promise(() => expect(max).toContainText(rupiah("7.990.000")));

    // Max with 550 added accounts holds a school of 1,050 for Rp16.735.000 a month.
    const calculator = page.locator("[data-school-calculator]");
    yield* Effect.promise(() =>
      calculator.getByRole("button", { name: "Max" }).click()
    );
    const added = calculator.getByLabel("Akun yang ditambah");
    yield* Effect.promise(() => added.fill("550"));
    yield* Effect.promise(() => added.blur());
    yield* Effect.promise(() =>
      expect(calculator.locator("dl")).toContainText("1.050")
    );
    yield* Effect.promise(() =>
      expect(calculator.locator("dl")).toContainText(rupiah("16.735.000"))
    );

    // Twelve months take 5 % off and bill the whole year at once.
    yield* Effect.promise(() =>
      page.getByRole("button", { name: TWELVE_MONTHS }).click()
    );
    yield* Effect.promise(() => expect(max).toContainText(rupiah("7.590.500")));
    yield* Effect.promise(() =>
      expect(max).toContainText(rupiah("91.086.000"))
    );
    expect(yield* readOverflow(page)).toBeLessThanOrEqual(0);
  }
);

for (const viewport of [desktopViewport, touchViewport]) {
  test.describe(`School marketing pages at ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("the landing leads to the free trial and shows the plans", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifySchoolLanding(page))
      );
    });

    test("the pricing page follows the period and counts added accounts", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifySchoolPricing(page))
      );
    });
  });
}

test("the School pages stand in the first HTML with their structured data", async ({
  page,
}) => {
  const responses = await Promise.all(
    Arr.map(["/en/school", "/de/school/pricing"], (path) =>
      page.request.get(path)
    )
  );
  const [landing, pricing] = await Promise.all(
    Arr.map(responses, (response) => response.text())
  );

  expect(landing).toContain('"@type":"BreadcrumbList"');
  expect(landing).toContain('"@type":"FAQPage"');
  expect(pricing).toContain('"@type":"Product"');
  expect(pricing).toContain('hreflang="id"');
});

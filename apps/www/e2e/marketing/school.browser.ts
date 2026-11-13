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

/** The structured data nodes and the Indonesian alternate that a School page's head carries. */
const BREADCRUMB_NODE = /"@type":\s*"BreadcrumbList"/u;
const FAQ_NODE = /"@type":\s*"FAQPage"/u;
const PRODUCT_NODE = /"@type":\s*"Product"/u;
const INDONESIAN_ALTERNATE = /hreflang="id"/iu;

/** A rupiah price as the page writes it, with the no-break space after the symbol. */
const rupiah = (digits: string) => `Rp ${digits}`;

/** Whether the page scrolls sideways at the current width. */
const readOverflow = (page: Page) =>
  Effect.promise(() =>
    page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
  );

/**
 * The name of the paper's right answer, the momentum of a 2 kg ball at 3 m/s: its formula reads 6, and no
 * other answer holds that digit.
 */
const MOMENTUM = /6/u;

/** The parts of the School landing under its hero, in the order the page shows them. */
const PARTS = ["forum", "class", "exams", "player", "year"] as const;

/** The ten types of question the paper names, in the order of the editor's type menu. */
const TYPES = 10;

const verifySchoolLanding = Effect.fn("NakafaE2E.verifySchoolLanding")(
  function* (page: Page) {
    yield* loadMarketingPage(page, "/en/school");
    yield* Effect.promise(() =>
      expect(page.getByRole("heading", { level: 1 })).toContainText(
        "One platform for your whole school"
      )
    );
    yield* Effect.promise(() =>
      expect(
        page.locator("#hero").getByRole("link", { name: "Start free trial" })
      ).toHaveAttribute("href", "/en/school/new")
    );
    // Each part has one title; the exam editor's own pages, which name their questions, stand under it.
    for (const part of PARTS) {
      yield* Effect.promise(() =>
        expect(
          page.locator(`section#${part} h2:not([data-slot="editor-demo"] h2)`)
        ).toHaveCount(1)
      );
    }
    // The paper names every type of question, and each press opens that type's question in the player.
    const paper = page.locator("#player");
    yield* Effect.promise(() => paper.scrollIntoViewIfNeeded());
    const types = paper.getByRole("group", { name: "Question types" });
    yield* Effect.promise(() =>
      expect(types.getByRole("button")).toHaveCount(TYPES)
    );
    yield* Effect.promise(() =>
      types.getByRole("button", { name: "True or false table" }).click()
    );
    yield* Effect.promise(() =>
      expect(paper.getByText("Momentum is measured in joules.")).toBeVisible()
    );
    yield* Effect.promise(() =>
      types
        .getByRole("button", { name: "Multiple choice", exact: true })
        .click()
    );
    const answer = paper.getByRole("radio", { name: MOMENTUM });
    yield* Effect.promise(() => answer.click());
    yield* Effect.promise(() => expect(answer).toBeChecked());
    // A header link to a feature opens it in its part.
    yield* Effect.promise(() => page.goto("/en/school#insight"));
    yield* Effect.promise(() =>
      expect(
        page.locator("#class").getByRole("button", { name: "Insight" })
      ).toHaveAttribute("aria-pressed", "true")
    );
    yield* Effect.promise(() =>
      expect(
        page.locator("#closing").getByRole("link", { name: "See pricing" })
      ).toHaveAttribute("href", "/en/school/pricing")
    );
    expect(yield* readOverflow(page)).toBeLessThanOrEqual(0);
  }
);

const verifySchoolPricing = Effect.fn("NakafaE2E.verifySchoolPricing")(
  function* (page: Page) {
    yield* loadMarketingPage(page, "/id/school/pricing");
    // Each paid card shows its price a month, and what a month costs over 12 months.
    const max = page.locator('[data-school-plan="max"]');
    yield* Effect.promise(() => expect(max).toContainText(rupiah("7.990.000")));
    yield* Effect.promise(() => expect(max).toContainText(rupiah("7.590.500")));
    yield* Effect.promise(() =>
      expect(page.locator('[data-school-plan="pro"]')).toContainText(
        rupiah("1.700.500")
      )
    );
    // The comparison's heads name the plans alone.
    yield* Effect.promise(() =>
      expect(page.locator("#compare thead")).not.toContainText("akun")
    );

    // Max with 550 added accounts holds a school of 1,050 for Rp16.735.000 a month.
    const calculator = page.locator("#accounts");
    yield* Effect.promise(() => calculator.scrollIntoViewIfNeeded());
    yield* Effect.promise(() =>
      calculator.getByRole("button", { name: "Max" }).click()
    );
    const added = calculator.getByLabel("Akun yang ditambah");
    yield* Effect.promise(() => added.fill("550"));
    yield* Effect.promise(() => added.blur());
    const figures = calculator.locator("dl");
    yield* Effect.promise(() => expect(figures).toContainText("1.050"));
    yield* Effect.promise(() =>
      expect(figures).toContainText(rupiah("16.735.000"))
    );

    // Twelve months take 5 % off and bill the whole year at once.
    yield* Effect.promise(() =>
      calculator.getByRole("button", { name: TWELVE_MONTHS }).click()
    );
    yield* Effect.promise(() =>
      expect(figures).toContainText(rupiah("15.898.250"))
    );
    yield* Effect.promise(() =>
      expect(figures).toContainText(rupiah("190.779.000"))
    );
    yield* Effect.promise(() => expect(figures).toContainText("hemat 5%"));
    expect(yield* readOverflow(page)).toBeLessThanOrEqual(0);
  }
);

for (const viewport of [desktopViewport, touchViewport]) {
  test.describe(`School marketing pages at ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("the landing leads to the free trial and shows every feature's screen", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifySchoolLanding(page))
      );
    });

    test("the pricing page shows each plan's yearly price and counts added accounts by period", async ({
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

  expect(landing).toMatch(BREADCRUMB_NODE);
  expect(landing).toMatch(FAQ_NODE);
  expect(pricing).toMatch(PRODUCT_NODE);
  expect(pricing).toMatch(INDONESIAN_ALTERNATE);
});

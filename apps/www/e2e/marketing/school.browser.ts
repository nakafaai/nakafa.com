import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { loadMarketingPage } from "@/e2e/support/marketing";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { stepTo } from "@/e2e/support/scroll";
import {
  desktopViewport,
  tabletPortraitViewport,
  touchViewport,
} from "@/e2e/support/viewport";

// The School prices show in the currency of the visitor's time zone, and these checks read the
// rupiah prices, so every test runs in a Jakarta zone, whatever zone the machine is in.
test.use({ timezoneId: "Asia/Jakarta" });

/** The name of the twelve-month period in Indonesian, which starts with its length. */
const TWELVE_MONTHS = /^12 bulan/u;

/** The structured data nodes and the Indonesian alternate that a School page's head carries. */
const BREADCRUMB_NODE = /"@type":\s*"BreadcrumbList"/u;
const FAQ_NODE = /"@type":\s*"FAQPage"/u;
const PLAN_NODE = /"@type":\s*"Service"/u;
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
const PARTS = [
  "forum",
  "library",
  "tasks",
  "exams",
  "player",
  "reports",
  "insight",
  "parents",
  "year",
] as const;

/** The address of the landing once the editor's Try as student has opened the player's part. */
const PLAYER_PART = /#player$/u;

/** An address on the machine that built the page, which no page a visitor reads may hold. */
const BUILD_ADDRESS = /localhost|127\.0\.0\.1/u;

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
    // Each part has one title; the School's own screens in a demo, which name their questions, stand under it.
    for (const part of PARTS) {
      yield* Effect.promise(() =>
        expect(
          page.locator(`section#${part} h2:not([data-slot$="-demo"] h2)`)
        ).toHaveCount(1)
      );
    }
    // The page shows the editor before the player, so a reader meets it first, and the walk follows the page down.
    // The editor stands in a frame outside any school, so nothing in it leaves the page: its Try as student opens
    // the player's part, and it offers no way back to a school's exams.
    const paper = page.locator("#player");
    const editor = page.locator('[data-slot="editor-demo"]');
    // The strip of pages draws every question's own controls in its thumbnails, and none of them stands inside the
    // button that opens its page.
    const pages = editor.getByRole("button", { name: "Pages" });
    yield* stepTo(page, pages);
    yield* Effect.promise(() =>
      expect(editor.locator('a[href]:not([href^="#"])')).toHaveCount(0)
    );
    yield* Effect.promise(() => pages.click());
    yield* Effect.promise(() =>
      expect(
        editor.getByRole("navigation", { name: "Pages" }).getByRole("button")
      ).not.toHaveCount(0)
    );
    yield* Effect.promise(() =>
      expect(page.locator("button button, button a, a button")).toHaveCount(0)
    );
    const attempt = editor.getByRole("link", { name: "Try as student" });
    yield* stepTo(page, attempt);
    yield* Effect.promise(() => attempt.click());
    yield* Effect.promise(() => expect(page).toHaveURL(PLAYER_PART));
    yield* Effect.promise(() => expect(paper).toBeInViewport());
    // The paper names every type of question, and each press opens that type's question in the player.
    const types = paper.getByRole("combobox", { name: "Question types" });
    // WebKit's scrollIntoView skips a part the page has not drawn yet, so the page steps to it as a reader does.
    yield* stepTo(page, types);
    yield* Effect.promise(() => types.click());
    const menu = page.getByRole("listbox");
    yield* Effect.promise(() =>
      expect(menu.getByRole("option")).toHaveCount(TYPES)
    );
    yield* Effect.promise(() =>
      menu.getByRole("option", { name: "True or false table" }).click()
    );
    yield* Effect.promise(() =>
      expect(paper.getByText("Momentum is measured in joules.")).toBeVisible()
    );
    yield* Effect.promise(() => types.click());
    yield* Effect.promise(() =>
      menu.getByRole("option", { name: "Multiple choice", exact: true }).click()
    );
    const answer = paper.getByRole("radio", { name: MOMENTUM });
    yield* Effect.promise(() => answer.click());
    yield* Effect.promise(() => expect(answer).toBeChecked());
    // The report card's code shows, and a parent's Scan opens the child's code in a dialog that closes again.
    const reports = page.locator("#reports");
    yield* stepTo(page, reports.getByRole("img", { name: "A QR code" }));
    yield* Effect.promise(() =>
      expect(reports.getByRole("img", { name: "A QR code" })).toBeVisible()
    );
    yield* Effect.promise(() =>
      expect(reports.locator('svg[aria-label^="A QR code"]')).toHaveCount(1)
    );
    yield* Effect.promise(() =>
      expect(reports.getByText("Verified", { exact: true })).toBeVisible()
    );
    const scan = page.locator("#parents").getByRole("button", { name: "Scan" });
    yield* stepTo(page, scan);
    yield* Effect.promise(() => scan.click());
    const code = page.getByRole("dialog", { name: "Ayu's report card" });
    yield* Effect.promise(() =>
      expect(code.getByRole("img", { name: "A QR code" })).toBeVisible()
    );
    yield* Effect.promise(() => page.keyboard.press("Escape"));
    yield* Effect.promise(() => expect(code).toBeHidden());
    // A header link to a feature lands on its part.
    yield* Effect.promise(() => page.goto("/en/school#insight"));
    yield* Effect.promise(() =>
      expect(page.locator("#insight h2")).toBeInViewport()
    );
    yield* Effect.promise(() =>
      expect(
        page.locator("#closing").getByRole("link", { name: "See pricing" })
      ).toHaveAttribute("href", "/en/school/pricing")
    );
    expect(yield* readOverflow(page)).toBeLessThanOrEqual(0);
  }
);

/** The opacity of the first element a selector names inside a part, as the browser computes it now. */
const readOpacity = (page: Page, selector: string) =>
  page.evaluate((target) => {
    const element = document.querySelector(target);
    return element === null ? -1 : Number(getComputedStyle(element).opacity);
  }, selector);

/**
 * Marks the page once Nina's dots show in the forum, from the next frame on, so a check that reaches the chat after
 * her reply has landed still knows the dots played.
 */
const watchTyping = (page: Page) =>
  page.evaluate(() => {
    const look = () => {
      const dots = document.querySelector("#forum [data-typing]");
      if (dots !== null && Number(getComputedStyle(dots).opacity) > 0) {
        document.documentElement.dataset.typingSeen = "";
        return;
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });

/** Whether the page saw Nina's dots in the forum. */
const readTypingSeen = (page: Page) =>
  page.evaluate(
    () => document.documentElement.dataset.typingSeen !== undefined
  );

/**
 * The forum and the library play as a reader meets them, and stay inside the page. Nina's dots breathe in the forum and
 * her reply lands where they stood; an emoji takes a press, and a message the reader sends lands in the open chat. A
 * wide screen shows the list of chats beside the chat: its search narrows the list, and a press opens another chat.
 * The library's video arrives on its shelf, its upload fills and its New badge lands.
 */
const verifyForumAndLibrary = Effect.fn("NakafaE2E.verifyForumAndLibrary")(
  function* (page: Page, wide: boolean) {
    yield* loadMarketingPage(page, "/en/school");
    yield* Effect.promise(() => watchTyping(page));
    const forum = page.locator("#forum");
    const composer = forum.getByRole("textbox", { name: "Write a message" });
    yield* stepTo(page, composer);
    yield* Effect.promise(() =>
      expect.poll(() => readTypingSeen(page)).toBe(true)
    );
    yield* Effect.promise(() =>
      expect.poll(() => readOpacity(page, "#forum [data-arrive]")).toBe(1)
    );
    yield* Effect.promise(() =>
      expect(
        forum.getByText("I put a short summary of chapter 3 next to it.", {
          exact: true,
        })
      ).toBeVisible()
    );
    yield* Effect.promise(() =>
      expect(
        forum.getByText("Momentum worksheet.pdf", { exact: true })
      ).toBeVisible()
    );
    yield* Effect.promise(() =>
      expect(forum.getByText("3 replies", { exact: true })).toBeVisible()
    );
    const thumbs = forum.getByRole("button", { name: "👍, 4" });
    yield* Effect.promise(() => thumbs.click());
    yield* Effect.promise(() =>
      expect(forum.getByRole("button", { name: "👍, 5" })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    );
    yield* Effect.promise(() => composer.fill("Thanks, Ms Rina!"));
    yield* Effect.promise(() =>
      forum.getByRole("button", { name: "Send" }).click()
    );
    yield* Effect.promise(() =>
      expect(forum.getByText("Thanks, Ms Rina!")).toBeVisible()
    );
    const chats = forum.getByRole("navigation", { name: "Chats" });
    if (wide) {
      yield* Effect.promise(() =>
        chats.getByRole("textbox", { name: "Search chats" }).fill("lab")
      );
      yield* Effect.promise(() =>
        expect(chats.getByRole("listitem")).toHaveCount(1)
      );
      yield* Effect.promise(() =>
        chats.getByRole("button", { name: "lab-groups" }).click()
      );
      yield* Effect.promise(() =>
        expect(
          forum.getByText("Here's our graph from the cart lab.", {
            exact: true,
          })
        ).toBeVisible()
      );
      yield* Effect.promise(() =>
        expect(forum.getByText("Thanks, Ms Rina!")).toHaveCount(0)
      );
    } else {
      yield* Effect.promise(() => expect(chats).toBeHidden());
    }
    const shelf = page
      .locator("#library")
      .getByRole("img", { name: "A chapter's shelf in the class library" });
    // The shelf is taller than a phone's screen, so the page steps to the video that arrives on it.
    yield* stepTo(page, page.locator("#library [data-arriving]"));
    yield* Effect.promise(() => expect(shelf).toBeVisible());
    yield* Effect.promise(() =>
      expect
        .poll(() => readOpacity(page, "#library [data-uploading]"))
        .toBeGreaterThan(0)
    );
    yield* Effect.promise(() =>
      expect.poll(() => readOpacity(page, "#library [data-new]")).toBe(1)
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
    const calculator = page.locator("#accounts [data-school-calculator]");
    yield* stepTo(page, calculator.getByRole("button", { name: "Max" }));
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
    const monthly = yield* Effect.promise(() =>
      figures.evaluate((summary) =>
        Math.round(summary.getBoundingClientRect().height)
      )
    );

    // Twelve months take 5 % off and bill the whole year at once.
    const period = calculator.getByRole("combobox", {
      name: "Periode tagihan",
    });
    yield* Effect.promise(() => period.click());
    yield* Effect.promise(() =>
      page.getByRole("option", { name: TWELVE_MONTHS }).click()
    );
    yield* Effect.promise(() =>
      expect(figures).toContainText(rupiah("15.898.250"))
    );
    yield* Effect.promise(() =>
      expect(figures).toContainText(rupiah("190.779.000"))
    );
    yield* Effect.promise(() => expect(figures).toContainText("hemat 5%"));
    const yearly = yield* Effect.promise(() =>
      figures.evaluate((summary) =>
        Math.round(summary.getBoundingClientRect().height)
      )
    );
    expect(yearly).toBe(monthly);
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

for (const viewport of [
  touchViewport,
  tabletPortraitViewport,
  desktopViewport,
]) {
  test.describe(`School forum and library at ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("the forum and the library play as the reader meets them and keep inside the page", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          verifyForumAndLibrary(page, viewport.width >= 768)
        )
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
  expect(landing).not.toMatch(BUILD_ADDRESS);
  expect(pricing).toMatch(PLAN_NODE);
  expect(pricing).toMatch(INDONESIAN_ALTERNATE);
});

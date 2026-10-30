import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/;

/** A phone and a desktop window. */
const WIDTHS = [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
] as const;

// Chromium's classic scrollbars, as Windows and Linux draw them: each takes room in the box it scrolls, unless
// the page hides it.
test.use({
  launchOptions: {
    args: ["--disable-features=OverlayScrollbar"],
    ignoreDefaultArgs: ["--hide-scrollbars"],
  },
});

/**
 * Runs in the page. It answers each scroller whose native bar takes room, with the room it takes, the room the
 * page keeps for its own bar, and how far the page reaches past the window's side.
 */
function scrollbarRoom() {
  const taken: string[] = [];
  for (const element of document.querySelectorAll("body *")) {
    const style = getComputedStyle(element);
    if (
      !(
        element instanceof HTMLElement &&
        (style.overflowX === "auto" ||
          style.overflowX === "scroll" ||
          style.overflowY === "auto" ||
          style.overflowY === "scroll")
      )
    ) {
      continue;
    }
    const side =
      element.offsetWidth -
      element.clientWidth -
      Number.parseFloat(style.borderLeftWidth) -
      Number.parseFloat(style.borderRightWidth);
    const bottom =
      element.offsetHeight -
      element.clientHeight -
      Number.parseFloat(style.borderTopWidth) -
      Number.parseFloat(style.borderBottomWidth);
    if (side > 0.5 || bottom > 0.5) {
      taken.push(
        `${element.tagName.toLowerCase()}[${element.dataset.slot ?? ""}] ${Math.round(side)}/${Math.round(bottom)}`
      );
    }
  }
  const root = document.documentElement;
  return {
    gutter: window.innerWidth - root.clientWidth,
    sideways: root.scrollWidth - root.clientWidth,
    taken,
  };
}

/** Expects no scrollbar of the page at its current address to take room, and the page to stay inside the window. */
async function expectNoScrollbarRoom(page: Page) {
  expect(await page.evaluate(scrollbarRoom), page.url()).toEqual({
    gutter: 0,
    sideways: 0,
    taken: [],
  });
}

for (const viewport of WIDTHS) {
  test(`no scrollbar takes room at ${viewport.width}px, where scrollbars are classic`, async ({
    baseURL,
    browser,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const host = `${school.slug}.localhost`;
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(
      signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
    );
    const page = await context.newPage();

    // The School's settings, with the sidebar and a table, and an exam's editor with its canvas.
    await page.goto(hostAddress(baseURL, host, "/settings/periods"));
    await waitUntilTakenOver(
      page.locator("header").getByRole("button", { name: "Add period" })
    );
    await expectNoScrollbarRoom(page);
    await page.goto(hostAddress(baseURL, host, "/exams"));
    const create = page.getByRole("button", { name: "Create exam" });
    await waitUntilTakenOver(create);
    await create.click();
    const creating = page.getByRole("dialog");
    await creating.getByRole("textbox", { name: "Exam title" }).fill("Gulir");
    await creating.getByRole("button", { name: "Create exam" }).click();
    await page.waitForURL(EDITOR_PATH);
    await expect(page.getByRole("button", { name: "Schedule" })).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expectNoScrollbarRoom(page);

    // A long lesson scrolls the page itself: the page keeps no gutter, and its own bar shows while it moves.
    await page.goto(new URL(pinnedRoutes.material.en, baseURL).href);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expectNoScrollbarRoom(page);
    const bar = page.locator('[data-slot="page-scrollbar"]');
    await page.mouse.wheel(0, 800);
    await expect(bar).toHaveAttribute("data-scrolling", "");
    await expect(bar).toBeVisible();
    await context.close();
  });
}

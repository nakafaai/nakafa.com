import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";

const NINA_DIALOG_NAME = /^Nina/;
const NEWSREADER_FONT = /Newsreader/;

const routes = [
  "/en/subjects/mathematics/analytic-geometry/hyperbola",
  "/en/articles/politics/regional-elections-turmoil",
];

/** Verifies the header controls against the real signed reading page. */
const verifyReadingHeader = Effect.fn("NakafaE2E.verifyReadingHeader")(
  function* (page: Page, href: string, width: number) {
    yield* seedDeniedAnalyticsConsent(page);
    yield* Effect.promise(() => page.goto(href));
    yield* waitForCommittedAppRouter(page, href, href, 15_000);
    const title = page.getByRole("heading", { level: 1 });
    yield* Effect.promise(() => expect(title).toHaveCount(1));
    yield* Effect.promise(() =>
      expect(title).toHaveCSS("text-align", "center")
    );
    yield* Effect.promise(() =>
      expect(title).toHaveCSS("font-family", NEWSREADER_FONT)
    );
    yield* Effect.promise(() =>
      expect(title).toHaveCSS("text-wrap-style", "balance")
    );
    const newsreaderLoaded = yield* Effect.promise(() =>
      page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].some(
          (font) =>
            font.family.includes("Newsreader") &&
            !font.family.includes("Fallback") &&
            font.status === "loaded"
        );
      })
    );
    yield* Effect.sync(() => expect(newsreaderLoaded).toBe(true));
    const summary = page.locator("header").filter({ has: title }).locator("p");
    yield* Effect.promise(() => expect(summary).toBeVisible());
    yield* Effect.promise(() => expect(summary).not.toBeEmpty());
    yield* Effect.promise(() =>
      expect(summary).toHaveCSS("text-align", "center")
    );
    yield* Effect.promise(() =>
      expect(summary).toHaveCSS("text-wrap-style", "pretty")
    );
    const titleText = yield* Effect.promise(() => title.innerText());
    const more = page.getByRole("button", {
      name: "More actions",
      exact: true,
    });
    const header = page.locator("header").filter({ has: more });
    yield* Effect.promise(() => expect(header).toBeVisible());
    yield* Effect.promise(() => expect(header).not.toContainText(titleText));
    yield* Effect.promise(() =>
      expect(
        header.getByRole("group", { name: "Content actions", exact: true })
      ).toBeVisible()
    );
    yield* Effect.promise(() =>
      expect(
        page.getByRole("button", { name: "Ask Nina", exact: true })
      ).toBeVisible()
    );
    yield* Effect.promise(() =>
      expect(
        page.getByRole("button", { name: "Copy Content", exact: true })
      ).toHaveCount(0)
    );
    const outline = header.getByRole("button", {
      name: "On this page",
      exact: true,
    });
    yield* Effect.promise(() => expect(outline).toBeVisible());
    const bounds = yield* Effect.promise(() =>
      Promise.all([more.boundingBox(), outline.boundingBox()])
    );
    yield* Effect.sync(() => {
      expect(bounds[0]?.y).toBe(bounds[1]?.y);
      expect(bounds[0]?.x).toBeLessThan(bounds[1]?.x ?? 0);
    });
    if (width < 1280) {
      yield* Effect.promise(() =>
        expect(outline).toHaveAttribute("aria-expanded", "false")
      );
      yield* Effect.promise(() => outline.click());
      const sidebar = page.locator('[role="dialog"][data-sidebar="sidebar"]');
      yield* Effect.promise(() => expect(sidebar).toBeVisible());
      yield* Effect.promise(() => page.keyboard.press("Escape"));
      yield* Effect.promise(() => expect(sidebar).toHaveCount(0));
      yield* Effect.promise(() => expect(outline).toBeFocused());
    } else {
      const sidebar = page.locator('[data-side="right"][data-slot="sidebar"]');
      const panel = sidebar.locator('[data-slot="sidebar-container"]');
      yield* Effect.promise(() =>
        expect(outline).toHaveAttribute("aria-expanded", "true")
      );
      yield* Effect.promise(() => outline.click());
      yield* Effect.promise(() =>
        expect(outline).toHaveAttribute("aria-expanded", "false")
      );
      yield* Effect.promise(() => expect(panel).not.toBeInViewport());
      yield* Effect.promise(() => outline.click());
      yield* Effect.promise(() =>
        expect(outline).toHaveAttribute("aria-expanded", "true")
      );
      yield* Effect.promise(() => expect(panel).toBeInViewport());
    }
    yield* Effect.promise(() => more.focus());
    yield* Effect.promise(() => page.keyboard.press("Enter"));
    const menu = page.getByRole("menu");
    yield* Effect.promise(() =>
      expect(menu.getByText("More", { exact: true })).toBeVisible()
    );
    yield* Effect.promise(() =>
      expect(menu.getByRole("menuitem")).toHaveCount(3)
    );
    const openIn = page.getByRole("menuitem", { name: "Open in", exact: true });
    if (width < 1280) {
      yield* Effect.promise(() => openIn.click());
    } else {
      yield* Effect.promise(() => openIn.hover());
    }
    for (const provider of ["GitHub", "ChatGPT", "Gemini", "Claude"]) {
      const link = page.getByRole("menuitem", {
        name: `Open in ${provider}`,
        exact: true,
      });
      yield* Effect.promise(() => expect(link).toBeVisible());
      yield* Effect.promise(() =>
        expect(link).toHaveAttribute("target", "_blank")
      );
    }
    yield* Effect.promise(() => page.keyboard.press("Escape"));
    yield* Effect.promise(() => expect(openIn).toBeFocused());
    yield* Effect.promise(() => page.keyboard.press("Escape"));
    yield* Effect.promise(() => expect(more).toBeFocused());
    yield* Effect.promise(() =>
      page.context().grantPermissions(["clipboard-read", "clipboard-write"])
    );
    yield* Effect.promise(() => more.click());
    yield* Effect.promise(() =>
      page.getByRole("menuitem", { name: "Copy Content", exact: true }).click()
    );
    yield* Effect.promise(() =>
      expect(page.getByText("Copied!", { exact: true })).toBeVisible({
        timeout: 15_000,
      })
    );
    const copiedContent = yield* Effect.promise(() =>
      page.evaluate(() => navigator.clipboard.readText())
    );
    yield* Effect.sync(() => expect(copiedContent).toContain(titleText));
    yield* Effect.promise(() => more.click());
    yield* Effect.promise(() =>
      page.getByRole("menuitem", { name: "Ask Nina", exact: true }).click()
    );
    const nina = page.getByRole("dialog", { name: NINA_DIALOG_NAME });
    yield* Effect.promise(() => expect(nina).toBeVisible());
    yield* Effect.promise(() =>
      expect(
        nina.getByRole("button", {
          name: `Explain ${titleText} in simple student-friendly language.`,
          exact: true,
        })
      ).toBeVisible()
    );
    yield* Effect.promise(() => expect(page.getByRole("menu")).toHaveCount(0));
    yield* Effect.promise(() =>
      nina.getByRole("button", { name: "Close", exact: true }).click()
    );
    yield* Effect.promise(() => expect(nina).toHaveCount(0));
    yield* Effect.promise(() => page.evaluate(() => window.scrollTo(0, 600)));
    yield* Effect.promise(() => expect(more).toBeInViewport());
    const overflow = yield* Effect.promise(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      )
    );
    yield* Effect.sync(() => expect(overflow).toBe(false));
  }
);

for (const width of [390, 1440]) {
  test.describe(`reading header at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    for (const href of routes) {
      test(href, async ({ page }) => {
        await Effect.runPromise(
          withObservedPageErrors(page, verifyReadingHeader(page, href, width))
        );
      });
    }
  });
}

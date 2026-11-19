import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { holdChunks, openRoute } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const HOME = "/en";
/** How far each step of the walk down the page scrolls, in pixels. */
const SCROLL_STEP = 900;
/** The window list that holds every section the page's HTML drew, before any script ran. */
const DRAWN = "nakafaDrawnSections";

/**
 * The home page hydrates each section after the hero in a boundary of its own,
 * once the reader nears it. Every section the static HTML drew stays the same
 * element once the page has come alive: React hydrated it in place and never
 * threw its markup away to draw it again, which would flash and shift the page.
 */
test("hydrates every home section in place, section by section", async ({
  page,
}) => {
  await page.addInitScript((mark: string) => {
    document.addEventListener("DOMContentLoaded", () => {
      Reflect.set(
        window,
        mark,
        Array.from(document.querySelectorAll("main section"))
      );
    });
  }, DRAWN);

  await page.goto(HOME);
  // A hydrated link runs the router: walk down the page, and wait for the last section's links.
  await expect
    .poll(
      async () => {
        await page.mouse.wheel(0, SCROLL_STEP);
        return page.evaluate(() =>
          Array.from(document.querySelectorAll("main section a")).every(
            (link) =>
              Object.keys(link).some((key) => key.startsWith("__reactProps$"))
          )
        );
      },
      { timeout: readinessTimeoutMilliseconds }
    )
    .toBe(true);

  const drawn = await page.evaluate((mark) => {
    const sections: Element[] = Reflect.get(window, mark) ?? [];
    return {
      connected: sections.filter((section) => section.isConnected).length,
      total: sections.length,
    };
  }, DRAWN);

  expect(drawn.total).toBeGreaterThan(5);
  expect(drawn.connected).toBe(drawn.total);
});

test("the home practice question keeps an early answer and scores the example Nina explains", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 320 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const release = await Effect.runPromise(
    holdChunks(page, { containing: "home-tryout-response" })
  );
  const demo = page.locator("#tryout");
  const options = demo.locator('[data-slot="marked-line"]');
  const mistake = options.filter({
    has: page.getByRole("radio", { name: "B 13" }),
  });
  const correct = options.filter({
    has: page.getByRole("radio", { name: "C 19" }),
  });

  try {
    await Effect.runPromise(openRoute(page, `${HOME}#tryout`));
    await expect(
      demo.locator('annotation[encoding="application/x-tex"]').first()
    ).toHaveText("\\triangle(a,b)=2a+\\frac{b}{m}");
    const spaces = await demo.locator('[data-slot="card"]').evaluate((card) => {
      const outer = card.getBoundingClientRect();
      const [number, prompt, answer] = Array.from(
        card.firstElementChild?.children ?? [],
        (part) => part.getBoundingClientRect()
      );
      if (!(number && prompt && answer)) {
        return [];
      }
      return [
        number.top - outer.top,
        prompt.top - number.bottom,
        answer.top - prompt.bottom,
        outer.bottom - answer.bottom,
      ];
    });
    expect(spaces).toHaveLength(4);
    expect(spaces[0]).toBeGreaterThan(0);
    expect(Math.max(...spaces) - Math.min(...spaces)).toBeLessThanOrEqual(1);
    await mistake.getByRole("radio").click();
    await expect(mistake).toHaveAttribute("data-pressed", "");
  } finally {
    await release();
  }

  await expect(mistake.getByRole("radio")).toBeChecked({
    timeout: readinessTimeoutMilliseconds,
  });
  await page.unrouteAll({ behavior: "wait" });
  await expect(mistake).toHaveAttribute("data-tone", "wrong");
  await correct.getByRole("radio").click();
  await expect(correct.getByRole("radio")).toBeChecked();
  await expect(correct).toHaveAttribute("data-tone", "correct");

  const nina = page.locator("#nina");
  await expect(
    nina
      .getByText("Why is 13 wrong?", { exact: true })
      .and(nina.locator('[aria-hidden="true"]'))
  ).toBeVisible();
  await expect(nina.locator('[data-slot="message-footer"]')).toHaveCount(0);
});

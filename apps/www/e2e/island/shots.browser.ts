import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { islandStage, openIsland } from "@/e2e/support/island";
import { signInLearner } from "@/e2e/support/learner";

// A scratch capture for the island pull requests: the home and the game from
// several angles and distances at three widths. The files land in the run's
// traces artifact.

const WIDTHS = [
  { hasTouch: true, height: 844, name: "390", width: 390 },
  { hasTouch: false, height: 1024, name: "768", width: 768 },
  { hasTouch: false, height: 900, name: "1440", width: 1440 },
] as const;

for (const size of WIDTHS) {
  for (const scheme of ["light", "dark"] as const) {
  test(`shots: the island at ${size.name} ${scheme}`, async ({ baseURL, browser, browserName }, testInfo) => {
    test.setTimeout(240_000);
    const origin = baseURL ?? "";
    const context = await browser.newContext({
      baseURL: origin,
      colorScheme: scheme,
      hasTouch: size.hasTouch,
      viewport: { height: size.height, width: size.width },
    });
    await Effect.runPromise(signInLearner(context, origin));
    const page = await context.newPage();
    const shot = async (name: string) => {
      await page.waitForTimeout(2500);
      await page.screenshot({ path: testInfo.outputPath(`${browserName}-${size.name}-${scheme}-${name}.png`) });
    };
    await page.goto("/en");
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await shot("home");
    await Effect.runPromise(openIsland(page, size.hasTouch));
    await expect(islandStage(page)).toHaveAttribute("data-drawn", "true");
    await shot("front");
    for (const [name, keys] of [
      ["turn90", ["q", "q"]],
      ["turn180", ["q", "q"]],
      ["turn270", ["q", "q"]],
      ["near", ["q", "q", "+", "+", "+", "+", "+"]],
      ["far", ["-", "-", "-", "-", "-", "-", "-", "-", "-", "-"]],
      ["far-turned", ["e", "e", "e"]],
    ] as const) {
      for (const key of keys) {
        await page.keyboard.press(key);
        await page.waitForTimeout(150);
      }
      await shot(name);
    }
    await context.close();
  });
}
}

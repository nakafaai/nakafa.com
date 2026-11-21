import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { collectUnusedPreloads } from "@/e2e/support/preload";

/** Allo's Latin face, which every page's text draws in: its source path, or the build's hashed asset. */
const ALLO_LATIN = /\/fonts\/allo\/latin\.woff2$|\/latin-[\w-]{8}\.woff2$/u;

/**
 * The document asks for Allo's Latin face with itself, so the face arrives
 * with the page instead of after the stylesheet has been read and laid out:
 * the text paints in Allo instead of swapping from its fallback in sight. The
 * stylesheet's request finds the preloaded file, so the face loads once, and
 * the page uses what it preloads.
 */
for (const path of ["/en", "/id/kurikulum"]) {
  test(`${path} loads Allo's Latin face once, from its preload`, async ({
    page,
  }) => {
    const warnings = await Effect.runPromise(
      collectUnusedPreloads(
        page,
        Effect.promise(() => page.goto(path))
      )
    );
    const requests = await page.evaluate((pattern) => {
      const face = new RegExp(pattern, "u");
      return performance
        .getEntriesByType("resource")
        .filter((entry) => face.test(new URL(entry.name).pathname))
        .map((entry) =>
          entry instanceof PerformanceResourceTiming ? entry.initiatorType : ""
        );
    }, ALLO_LATIN.source);

    expect(requests).toEqual(["link"]);
    expect(warnings).toEqual([]);
    expect(
      await page.evaluate(() => document.fonts.check('16px "Allo"', "Nakafa"))
    ).toBe(true);
  });
}

import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { collectUnusedPreloads } from "@/e2e/support/preload";

/**
 * The fonts the document preloads that are files of the stylesheet's Allo
 * faces, and how each of them was requested. A file's name says nothing (the
 * build names Allo's Latin face `latin-*`, as it names Amiri Quran Line's),
 * so the faces are read from the stylesheet itself. The page serializes this
 * function.
 */
function readAlloFaces() {
  const sources = [...document.styleSheets]
    .flatMap((sheet) => [...sheet.cssRules])
    .filter(
      (rule) =>
        rule instanceof CSSFontFaceRule &&
        rule.style.getPropertyValue("font-family").replaceAll('"', "") ===
          "Allo"
    )
    .map((rule) => {
      const src =
        rule instanceof CSSFontFaceRule
          ? rule.style.getPropertyValue("src")
          : "";
      const start = src.indexOf("url(") + "url(".length;
      const address = src.slice(start, src.indexOf(")", start));
      return new URL(address.replaceAll('"', ""), document.baseURI).href;
    });
  const preloads = [
    ...document.querySelectorAll<HTMLLinkElement>(
      'link[rel="preload"][as="font"]'
    ),
  ].map((link) => link.href);
  const preloaded = preloads.filter((href) => sources.includes(href));
  const requests = performance
    .getEntriesByType("resource")
    .filter((entry) => preloaded.includes(entry.name))
    .map((entry) => ({
      initiator:
        entry instanceof PerformanceResourceTiming ? entry.initiatorType : "",
      name: entry.name,
    }));
  return { preloaded, requests };
}

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
    const faces = await page.evaluate(readAlloFaces);

    expect(faces.preloaded).toHaveLength(1);
    expect(faces.requests).toEqual([
      { initiator: "link", name: faces.preloaded[0] },
    ]);
    expect(warnings).toEqual([]);
    expect(
      await page.evaluate(() => document.fonts.check('16px "Allo"', "Nakafa"))
    ).toBe(true);
  });
}

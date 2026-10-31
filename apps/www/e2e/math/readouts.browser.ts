import { expect, test } from "@playwright/test";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { lineSceneCards, VISUAL_CARD_FOOTER } from "@/e2e/support/selector";

/** KaTeX's runtime, the one chunk that typesets math in the browser. */
const KATEX_RUNTIME = /\/assets\/katex-[\w-]+\.js/;

/** The interval separator of each locale's readouts, as `intervalSeparator` writes it. */
const separators = { de: "; ", en: ", ", id: "; " } as const;

/**
 * A lesson's line cards draw their readouts on the server, in the lesson's
 * locale, as the lesson body draws its formulas: the page arrives with every
 * card's readouts typeset and preloads no math runtime for them.
 */
for (const locale of ["de", "en", "id"] as const) {
  test(`a ${locale} lesson's line cards arrive with typeset readouts and preload no math runtime`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    const response = await page.goto(pinnedRoutes.material[locale]);
    const html = (await response?.text()) ?? "";
    expect(KATEX_RUNTIME.exec(html)?.[0]).toBeUndefined();

    const cards = lineSceneCards(page);
    await expect(cards.first()).toBeAttached();
    // Each card's first interval readout: the TeX that KaTeX keeps beside its markup.
    const readouts = await cards.evaluateAll(
      (elements, footer) =>
        elements.map(
          (card) =>
            [...card.querySelectorAll(`${footer} annotation`)]
              .map((annotation) => annotation.textContent ?? "")
              .find((tex) => tex.startsWith("[")) ?? ""
        ),
      VISUAL_CARD_FOOTER
    );

    expect(readouts.length).toBeGreaterThan(0);
    for (const readout of readouts) {
      expect(readout).toContain(separators[locale]);
    }
  });
}

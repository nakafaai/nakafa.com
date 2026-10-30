import { expect, test } from "@playwright/test";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** WCAG 2.2 AA for text of a normal size. */
const AA = 4.5;

/**
 * Runs in the page. It measures, inside the lesson's first highlight that holds a link: the link's colour against
 * the highlight's fill, whether the link keeps its underline, the highlight's own text against its fill (math, a
 * bolder or slanted word and a sub- or superscript inherit it), and the page's inline code placed inside the
 * highlight against its own chip. Colours are read through a canvas, so any CSS colour, oklch included, counts
 * as the sRGB pixel the screen draws.
 */
function measureHighlight() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const rgb = (color: string) => {
    if (context === null) {
      return [0, 0, 0];
    }
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [red = 0, green = 0, blue = 0] = context.getImageData(
      0,
      0,
      1,
      1
    ).data;
    return [red, green, blue];
  };
  const luminance = (color: string) => {
    const [red = 0, green = 0, blue = 0] = rgb(color).map((channel) => {
      const value = channel / 255;
      return value <= 0.039_28
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const contrast = (front: string, back: string) => {
    const [light, dark] = [luminance(front), luminance(back)].sort(
      (a, b) => b - a
    );
    return (
      Math.round((((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05)) * 100) / 100
    );
  };

  const link = document.querySelector("main strong a[href]");
  const highlight = link?.closest("strong");
  if (!(link instanceof HTMLElement && highlight instanceof HTMLElement)) {
    return null;
  }
  const fill = getComputedStyle(highlight).backgroundColor;
  const code = document.querySelector("main p code");
  const placed = code instanceof HTMLElement ? code.cloneNode(true) : null;
  if (placed instanceof HTMLElement) {
    highlight.append(placed);
  }
  const result = {
    code:
      placed instanceof HTMLElement
        ? contrast(
            getComputedStyle(placed).color,
            getComputedStyle(placed).backgroundColor
          )
        : null,
    link: contrast(getComputedStyle(link).color, fill),
    text: contrast(getComputedStyle(highlight).color, fill),
    underline: getComputedStyle(link).textDecorationLine.includes("underline"),
  };
  if (placed instanceof HTMLElement) {
    placed.remove();
  }
  return result;
}

for (const scheme of ["light", "dark"] as const) {
  test(`a link inside a highlight reads at AA contrast in ${scheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    // Its highlight reads "follow from [the limit definition of the derivative](…)".
    await page.goto(pinnedRoutes.derivative.en);
    const link = page.locator("main strong a[href]").first();
    await expect(link).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await link.scrollIntoViewIfNeeded();

    const measured = await page.evaluate(measureHighlight);
    expect(measured, scheme).not.toBeNull();
    expect(measured?.underline, `${scheme} link keeps its underline`).toBe(
      true
    );
    expect(
      measured?.link ?? 0,
      `${scheme} link on the highlight`
    ).toBeGreaterThanOrEqual(AA);
    expect(
      measured?.text ?? 0,
      `${scheme} highlight text`
    ).toBeGreaterThanOrEqual(AA);
    if (measured?.code !== null) {
      expect(
        measured?.code ?? 0,
        `${scheme} inline code in the highlight`
      ).toBeGreaterThanOrEqual(AA);
    }
    await page
      .locator("main p", { has: link })
      .first()
      .screenshot({
        path: test.info().outputPath(`highlight-link-${scheme}.png`),
      });
  });
}

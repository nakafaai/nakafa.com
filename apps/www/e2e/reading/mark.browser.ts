import { expect, test } from "@playwright/test";
import { editorDocument } from "@repo/design-system/components/editor/frame";

/** WCAG 2.2 AA for text of a normal size. */
const AA = 4.5;

/**
 * Runs in the page. It draws a highlight that holds a link and inline code in a text with the editor's own
 * classes (`editorDocument`, as the editor and the saved words draw a text), then measures the link's colour
 * against the highlight's fill, whether the link keeps its underline, the highlight's own text against its fill,
 * and the code against its own chip. Colours are read through a canvas, so any CSS colour counts as the sRGB pixel
 * the screen draws.
 */
function measureEditorMark(classes: string) {
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

  const text = document.createElement("div");
  text.className = classes;
  const paragraph = document.createElement("p");
  const mark = document.createElement("mark");
  const link = document.createElement("a");
  link.href = "#mark";
  link.textContent = "a link";
  const code = document.createElement("code");
  code.textContent = "x + 1";
  mark.append("words with ", link, " and ", code);
  paragraph.append(mark);
  text.append(paragraph);
  document.body.append(text);
  const fill = getComputedStyle(mark).backgroundColor;
  const result = {
    code: contrast(
      getComputedStyle(code).color,
      getComputedStyle(code).backgroundColor
    ),
    link: contrast(getComputedStyle(link).color, fill),
    text: contrast(getComputedStyle(mark).color, fill),
    underline: getComputedStyle(link).textDecorationLine.includes("underline"),
  };
  text.remove();
  return result;
}

for (const scheme of ["light", "dark"] as const) {
  test(`a link inside the editor's highlight reads at AA contrast in ${scheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/en");
    await expect(page.locator("main")).toBeVisible();

    const measured = await page.evaluate(measureEditorMark, editorDocument());
    expect(measured.underline, `${scheme} link keeps its underline`).toBe(true);
    expect(
      measured.link,
      `${scheme} link on the highlight`
    ).toBeGreaterThanOrEqual(AA);
    expect(measured.text, `${scheme} highlight text`).toBeGreaterThanOrEqual(
      AA
    );
    expect(
      measured.code,
      `${scheme} code in the highlight`
    ).toBeGreaterThanOrEqual(AA);
  });
}

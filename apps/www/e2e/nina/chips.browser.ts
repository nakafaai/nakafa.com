import { expect, test } from "@playwright/test";
import { Effect, Schema } from "effect";
import {
  chipsIn,
  chipsOfComposer,
  composerOf,
  openComposer,
  pickFiles,
  pictureOf,
  runPage,
  TRANSPARENT,
  write,
} from "../support/attachment";
import { onThePage, openChatPage, runOnPage } from "../support/chat";
import { UNCONFIRMED } from "../support/sheet";
import { readinessTimeoutMilliseconds } from "../support/timeout";
import { SAVE } from "../support/upload";

/** The themes a chip is read in. */
const ThemeSchema = Schema.Literals(["light", "dark"]);

/**
 * How much of its box a preview picture covers, in the page: the box is the
 * picture's element, and object-fit decides how the picture sits in it.
 */
const readPreviewCover = (chip: HTMLElement) => {
  const picture = chip.querySelector("img");
  if (!picture || picture.naturalWidth === 0) {
    return null;
  }
  const box = picture.getBoundingClientRect();
  const fit = getComputedStyle(picture).objectFit;
  const widthRatio = box.width / picture.naturalWidth;
  const heightRatio = box.height / picture.naturalHeight;
  const scale =
    fit === "cover"
      ? Math.max(widthRatio, heightRatio)
      : Math.min(widthRatio, heightRatio);
  return {
    coveredHeight: Math.min(1, (picture.naturalHeight * scale) / box.height),
    coveredWidth: Math.min(1, (picture.naturalWidth * scale) / box.width),
  };
};

test.describe("Previews of images in the composer", () => {
  test.use({ viewport: { height: 900, width: 390 } });

  for (const shape of [
    { height: 4000, name: "tall.png", width: 200 },
    { height: 200, name: "panorama.png", width: 4000 },
  ]) {
    test(`a ${shape.width} by ${shape.height} image fills its chip`, async ({
      page,
    }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          const composer = yield* openComposer(page);
          yield* pickFiles(composer, [
            yield* pictureOf(page, shape.name, shape),
          ]);
          const chip = chipsIn(composer).first();

          yield* Effect.promise(async () => {
            await expect(
              chip.getByRole("img", { name: shape.name })
            ).toBeVisible();
            await expect
              .poll(async () => {
                const cover = await chip.evaluate(readPreviewCover);
                return cover
                  ? Math.min(cover.coveredWidth, cover.coveredHeight)
                  : 0;
              })
              .toBeGreaterThanOrEqual(0.99);
          });
        })
      );
    });
  }
});

/** The opaque color behind a chip's picture and the page's theme, read in the page. */
const readBackdrop = (chip: HTMLElement) => {
  const media = chip.querySelector('[data-slot="attachment-media"]');
  if (!media) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.height = 1;
  canvas.width = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  // The canvas converts any CSS color, such as an oklch token, to sRGB.
  context.fillStyle = getComputedStyle(media).backgroundColor;
  context.fillRect(0, 0, 1, 1);
  const [red = 0, green = 0, blue = 0, alpha = 0] = context.getImageData(
    0,
    0,
    1,
    1
  ).data;
  return {
    alpha,
    blue,
    dark: document.documentElement.classList.contains("dark"),
    green,
    red,
  };
};

/** The linear light of one 0 to 255 sRGB channel, as WCAG defines it. */
const linear = (channel: number) => {
  const value = channel / 255;
  return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

/** The relative luminance of an sRGB color, as WCAG defines it. */
const luminance = ({
  blue,
  green,
  red,
}: {
  blue: number;
  green: number;
  red: number;
}) => 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);

for (const scheme of ThemeSchema.literals) {
  test.describe(`A transparent image with dark ink in the ${scheme} theme`, () => {
    test.use({ colorScheme: scheme, viewport: { height: 900, width: 390 } });

    test("stays visible on its chip", async ({ page }) => {
      await runPage(
        page,
        Effect.gen(function* () {
          const composer = yield* openComposer(page);
          yield* pickFiles(composer, [
            yield* pictureOf(page, "formula.png", {
              height: 120,
              ink: true,
              width: 240,
            }),
          ]);
          const chip = chipsIn(composer).first();
          yield* Effect.promise(() => expect(chip).toBeVisible());
          // A chip without a picture, or a page that cannot draw, reads as none
          // and ends the test with that failure.
          const backdrop = yield* Effect.promise(() =>
            chip.evaluate(readBackdrop)
          ).pipe(Effect.flatMap(Effect.fromNullishOr));

          yield* Effect.sync(() => {
            expect(backdrop.dark).toBe(scheme === "dark");
            expect(backdrop.alpha).toBe(255);
            // Black ink against the backdrop, as WCAG measures contrast.
            const ratio = (luminance(backdrop) + 0.05) / 0.05;
            expect(ratio).toBeGreaterThanOrEqual(4.5);
          });
        })
      );
    });
  });
}

/** The wash that a failed picture lays over itself, as the browser computes it. */
const readWash = (element: Element) =>
  getComputedStyle(element, "::after").backgroundColor;

test.describe("A picture whose upload failed in the composer", () => {
  test.use({ viewport: { height: 900, width: 390 } });
  test.describe.configure({ timeout: 180_000 });

  test("shows the failure on the picture", async ({ baseURL, page }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes } = yield* openChatPage(page, origin);
        const composer = onThePage(page);
        yield* pickFiles(composer, [
          yield* pictureOf(page, "lesson.png", { height: 64, width: 64 }),
        ]);
        yield* write(composer, "Explain this picture");
        const chip = chipsOfComposer(composer).first();
        const picture = chip.locator('[data-slot="attachment-media"]');
        changes.failNext(SAVE);

        yield* Effect.promise(async () => {
          // Before the send the picture has no wash, so a failure adds this one.
          await expect.poll(() => picture.evaluate(readWash)).toBe(TRANSPARENT);
          await composerOf(composer).press("Enter");
          await expect(page.getByText(UNCONFIRMED).first()).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(chip).toHaveAttribute("data-state", "error");
          await expect(chip).toHaveCSS("border-top-color", TRANSPARENT);
          await expect
            .poll(() => picture.evaluate(readWash))
            .not.toBe(TRANSPARENT);
        });
      })
    );
  });
});

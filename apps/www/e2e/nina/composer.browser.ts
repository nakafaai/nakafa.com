import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect, HashSet } from "effect";
import { GERMAN, openComposer } from "@/e2e/support/attachment";
import { CHAT_PATH, runOnPage } from "@/e2e/support/chat";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForSlide } from "@/e2e/support/layout";
import { signInLearner } from "@/e2e/support/learner";
import { NINA_SECTION, SHEET_POPUP } from "@/e2e/support/selector";
import { openSheet } from "@/e2e/support/sheet";

const SAMPLE_IMAGE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=",
  "base64"
);

// One synchronous read keeps every box in the same frame while the page scrolls.
const readComposerGeometry = (form: HTMLFormElement) => {
  const group = form.querySelector('[data-slot="input-group"]');
  const textarea = form.querySelector("textarea");
  const buttons = form.querySelectorAll(
    '[data-slot="input-group-addon"] button'
  );
  const preview = form.querySelector('[data-slot="attachment"]');
  if (!(group && textarea) || buttons.length !== 2) {
    return null;
  }
  const box = group.getBoundingClientRect();
  const input = textarea.getBoundingClientRect();
  const [attach, send] = Array.from(buttons, (button) =>
    button.getBoundingClientRect()
  );
  const attachment = preview?.getBoundingClientRect();
  return {
    attachInset: attach.left - box.left,
    bottomInset: box.bottom - send.bottom,
    previewAboveInput: attachment ? input.top - attachment.bottom : null,
    previewInset: attachment ? attachment.left - input.left : null,
    rows: [attach.top, send.top].map((top) => top - box.top),
    sendInset: box.right - send.right,
    widths: [attach.width, send.width],
  };
};

const verifyComposer = Effect.fn("NakafaE2E.verifyNinaComposer")(function* (
  scope: Locator
) {
  const input = scope.getByRole("textbox", { name: "Ask Nina anything..." });
  const composer = input.locator("xpath=ancestor::form");
  const fieldset = composer.locator('[data-slot="input-group"]');
  const attach = composer.getByRole("button", { name: "Attach files" });
  const send = composer.getByRole("button", { name: "Send message" });

  yield* Effect.promise(() => input.fill("A question with an attachment"));
  yield* Effect.promise(() => expect(input).toHaveCSS("font-size", "15px"));
  for (const control of [attach, send]) {
    yield* Effect.promise(() => expect(control).toHaveCSS("height", "36px"));
  }
  const geometry = yield* Effect.promise(() =>
    composer.evaluate(readComposerGeometry)
  );
  yield* Effect.sync(() => {
    expect(geometry).not.toBeNull();
    if (!geometry) {
      return;
    }
    expect(geometry.widths).toEqual([36, 36]);
    expect(HashSet.size(HashSet.fromIterable(geometry.rows))).toBe(1);
    expect(geometry.attachInset).toBeCloseTo(13, 1);
    expect(geometry.sendInset).toBeCloseTo(13, 1);
    expect(geometry.bottomInset).toBeCloseTo(13, 1);
  });

  // The real shared attachment flow must work in every entry surface.
  yield* Effect.promise(async () => {
    const selection = scope.page().waitForEvent("filechooser");
    await attach.click();
    await (await selection).setFiles({
      buffer: SAMPLE_IMAGE,
      mimeType: "image/png",
      name: "nina.png",
    });
  });
  const preview = composer.getByRole("img", { name: "nina.png" });
  yield* Effect.promise(() => expect(preview).toBeVisible());
  const attached = yield* Effect.promise(() =>
    composer.evaluate(readComposerGeometry)
  );
  yield* Effect.sync(() => {
    expect(attached?.previewInset).toBeCloseTo(12, 1);
    expect(attached?.previewAboveInput).toBeGreaterThanOrEqual(0);
  });
  yield* Effect.promise(() =>
    composer.getByRole("button", { name: "Remove nina.png" }).click()
  );
  yield* Effect.promise(() => expect(preview).toHaveCount(0));
  yield* Effect.promise(() =>
    expect(fieldset).toHaveCSS("overflow", "visible")
  );
  yield* Effect.promise(() => input.fill(""));
});

const verifySurfaces = Effect.fn("NakafaE2E.verifyNinaSurfaces")(function* (
  page: Page,
  origin: string
) {
  // A visitor's attach button asks for sign-in, so a learner attaches.
  yield* seedAnalyticsConsent(page, "denied");
  yield* signInLearner(page.context(), origin);
  yield* Effect.promise(() => page.goto("/en"));
  yield* verifyComposer(page.locator(NINA_SECTION));

  yield* Effect.promise(() => page.goto(CHAT_PATH));
  yield* verifyComposer(page.locator("main"));

  yield* openSheet(page);
  // The composer is in the sheet from its first frame, so its geometry is
  // read once the sheet has stopped sliding.
  yield* waitForSlide(page.locator(SHEET_POPUP));
  yield* verifyComposer(page.locator(SHEET_POPUP));
});

for (const width of [390, 1440]) {
  test.describe(`Nina surfaces at ${width}px`, () => {
    // This contract covers composer geometry, not motion. Marketing pages
    // scroll smoothly unless motion is reduced, and a smooth scroll can keep
    // Playwright's actionability scroll from settling on the showcase controls.
    test.use({ reducedMotion: "reduce", viewport: { height: 900, width } });

    test("keeps composer controls and attachments consistent across bento, chat and lesson sheet", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) => verifySurfaces(page, origin));
    });
  });
}

test.describe("The file picker of the composer in German", () => {
  test("is named in German, and the attach button opens it", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        // The new chat page in German, where the composer's labels are German.
        const composer = yield* openComposer(page, origin, "de", GERMAN);

        yield* Effect.promise(async () => {
          const chooser = page.waitForEvent("filechooser");
          await composer.getByRole("button", { name: GERMAN.attach }).click();
          await chooser;
        });
        // The picker is hidden, so its accessible name is the aria-label it
        // carries, which Playwright's name matcher does not read while hidden.
        yield* Effect.promise(() =>
          expect(composer.locator('input[type="file"]')).toHaveAttribute(
            "aria-label",
            GERMAN.attach
          )
        );
      })
    );
  });
});

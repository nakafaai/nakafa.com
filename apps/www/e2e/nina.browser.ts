import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";

const LESSON =
  "/en/subjects/mathematics/function-composition-inverse-function/function-concept";
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
  if (!(group && textarea) || buttons.length !== 3) {
    return null;
  }
  const box = group.getBoundingClientRect();
  const input = textarea.getBoundingClientRect();
  const [attach, model, send] = Array.from(buttons, (button) =>
    button.getBoundingClientRect()
  );
  const attachment = preview?.getBoundingClientRect();
  return {
    attachInset: attach.left - box.left,
    bottomInset: box.bottom - send.bottom,
    modelGap: send.left - model.right,
    previewAboveInput: attachment ? input.top - attachment.bottom : null,
    previewInset: attachment ? attachment.left - input.left : null,
    rows: [attach.top, model.top, send.top].map((top) => top - box.top),
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
  const model = composer.getByRole("button", { name: "Lite", exact: true });
  const send = composer.getByRole("button", { name: "Send message" });

  yield* Effect.promise(() => input.fill("A question with an attachment"));
  yield* Effect.promise(() => expect(input).toHaveCSS("font-size", "15px"));
  for (const control of [attach, model, send]) {
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
    expect(new Set(geometry.rows).size).toBe(1);
    expect(geometry.modelGap).toBeGreaterThan(0);
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
  page: Page
) {
  yield* seedDeniedAnalyticsConsent(page);
  yield* Effect.promise(() => page.goto("/en"));
  yield* verifyComposer(page.locator('[data-slot="nina-showcase"]'));

  yield* Effect.promise(() => page.goto("/en/chat"));
  yield* verifyComposer(page.locator("main"));

  yield* Effect.promise(() => page.goto(LESSON));
  yield* Effect.promise(() =>
    page.getByRole("button", { name: "Ask Nina", exact: true }).click()
  );
  yield* verifyComposer(page.locator('[data-slot="sheet-popup"]'));
});

for (const width of [390, 1440]) {
  test.describe(`Nina surfaces at ${width}px`, () => {
    // This contract covers composer geometry, not motion. Marketing pages
    // scroll smoothly unless motion is reduced, and a smooth scroll can keep
    // Playwright's actionability scroll from settling on the showcase controls.
    test.use({ reducedMotion: "reduce", viewport: { height: 900, width } });

    test("keeps composer controls and attachments consistent across bento, chat and lesson sheet", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifySurfaces(page))
      );
    });
  });
}

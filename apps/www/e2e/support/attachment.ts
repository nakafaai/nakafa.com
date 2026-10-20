import { expect, type Locator, type Page } from "@playwright/test";
import de from "@repo/internationalization/dictionaries/de.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect, Schema } from "effect";
import { CHAT_PATH } from "./chat";
import { seedAnalyticsConsent } from "./consent";
import { withObservedPageErrors } from "./observe";
import { readinessTimeoutMilliseconds } from "./timeout";

/** A file for the picker, in the form Playwright hands to a file chooser. */
const UploadSchema = Schema.Struct({
  buffer: Schema.instanceOf(Buffer),
  mimeType: Schema.String,
  name: Schema.String,
});
type Upload = typeof UploadSchema.Type;

/** The media type of a Word file, which Nina does not read. */
export const WORD_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** A file of `size` bytes, such as a PDF the learner picked. */
export function fileOf(name: string, mimeType: string, size: number): Upload {
  return { buffer: Buffer.alloc(size, "a"), mimeType, name };
}

/** A picture of one byte: enough for the picker to take it as an image. */
export const photo = (name: string) => fileOf(name, "image/png", 1);

/**
 * Draws a PNG of `width` by `height` pixels in the page, so the file is a real
 * picture with a transparent background. With `ink` it also carries a dark
 * mark, such as a formula exported with a transparent background.
 */
const drawPicture = async ({
  height,
  ink,
  width,
}: {
  height: number;
  ink: boolean;
  width: number;
}) => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    return "";
  }
  if (ink) {
    context.fillStyle = "#000000";
    context.fillRect(width / 4, height / 4, width / 2, height / 2);
  }
  const blob = await canvas.convertToBlob({ type: "image/png" });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

/** A picture of the given size, drawn by the page and named `name`. */
export const pictureOf = Effect.fn("NakafaE2E.pictureOf")(function* (
  page: Page,
  name: string,
  size: { height: number; ink?: boolean; width: number }
) {
  const base64 = yield* Effect.promise(() =>
    page.evaluate(drawPicture, {
      height: size.height,
      ink: size.ink ?? false,
      width: size.width,
    })
  );
  return {
    buffer: Buffer.from(base64, "base64"),
    mimeType: "image/png",
    name,
  } satisfies Upload;
});

/** The names of the composer's controls in English and in German. */
export const ENGLISH = {
  attach: en.Ai["attach-files"],
  input: en.Ai["text-placeholder"],
  send: en.Ai["send-message"],
};
export const GERMAN = {
  attach: de.Ai["attach-files"],
  input: de.Ai["text-placeholder"],
  send: de.Ai["send-message"],
};

/** The box where the learner writes to Nina, in the language of the page. */
export const composerOf = (scope: Locator, labels = ENGLISH) =>
  scope.getByRole("textbox", { name: labels.input });

/** Opens the picker of a composer and chooses `files`, the way a learner does. */
export const pickFiles = Effect.fn("NakafaE2E.pickFiles")(function* (
  scope: Locator,
  files: readonly Upload[]
) {
  yield* Effect.promise(async () => {
    const chooser = scope.page().waitForEvent("filechooser");
    await scope.getByRole("button", { name: ENGLISH.attach }).click();
    await (await chooser).setFiles([...files]);
  });
});

/**
 * Opens a chat page as a visitor, who can choose files and write without
 * signing in, and returns its composer. The new chat of the English site, read
 * with the English labels, unless another page and its labels are given.
 */
export const openComposer = Effect.fn("NakafaE2E.openComposer")(function* (
  page: Page,
  path = CHAT_PATH,
  labels = ENGLISH
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* Effect.promise(() => page.goto(path));
  const composer = page.locator("main");
  yield* Effect.promise(() =>
    expect(composerOf(composer, labels)).toBeVisible()
  );
  return composer;
});

/** Runs the program of one browser test, which fails on an error that nothing caught. */
export const runPage = <E>(page: Page, program: Effect.Effect<void, E>) =>
  Effect.runPromise(withObservedPageErrors(page, program));

/** The chips a composer or a message shows for its attachments. */
export function chipsIn(scope: Locator) {
  return scope.locator('[data-slot="attachment"]');
}

/**
 * The chips in a composer for the files that a pick did not attach. Each one
 * names its file and gives its reason, in the refused state, and never uploads.
 */
export function refusedChipsIn(scope: Locator) {
  return scope.locator('[data-slot="attachment"][data-state="error"]');
}

/** The chips of the messages on the page, which are not the chips of the composer. */
export function chipsOfMessages(page: Page) {
  return chipsIn(page.locator('[data-slot="message"]'));
}

/**
 * The chips inside the box where the learner writes. A page that shows the
 * chat holds the chips of its messages as well, which are not these.
 */
export function chipsOfComposer(scope: Locator) {
  return chipsIn(scope.locator('[data-slot="input-group"]'));
}

/** The computed color of a background or a border that is not drawn, as the browser reports it. */
export const TRANSPARENT = "rgba(0, 0, 0, 0)";

/** Writes the prompt and waits until the page lets it be sent. */
export const write = Effect.fn("NakafaE2E.write")(function* (
  scope: Locator,
  text: string,
  labels = ENGLISH
) {
  yield* Effect.promise(async () => {
    await composerOf(scope, labels).fill(text);
    await expect(scope.getByRole("button", { name: labels.send })).toBeEnabled({
      timeout: readinessTimeoutMilliseconds,
    });
  });
});

/** The notices on the page that contain `text`. */
export function noticeWith(page: Page, text: string) {
  return page.locator("[data-sonner-toast]").filter({ hasText: text });
}

import { expect, type Locator, type Page } from "@playwright/test";
import { MutableList, Option } from "effect";
import { CONVEX_SOCKET, decodeGiven } from "@/e2e/support/frames";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of an exam's editor on the school host. */
const EDITOR_PATH = /\/exams\/[^/]+\/edit$/u;

/** The exam toolbar, in the row under the editor's header. */
export const TOOLBAR = '[data-slot="editor-toolbar"]';

/** The popover of the toolbar's More control, which holds the controls the row has no room for. */
const POPOVER = '[data-slot="popover-content"]';

/**
 * A warning the editor's sync logs when it drops a step of its own, which a reader sees as an edit that
 * appears and then vanishes (`dropUnsendable` and `reopen` in `src/lib/editor/replay.ts`).
 */
const DROPPED = /dropped/iu;

/**
 * Creates an exam from the school's exams page and waits until the first question's prompt takes
 * changes. It returns that prompt.
 */
export async function openNewExam(page: Page, address: string, title: string) {
  await page.goto(address);
  const create = page.getByRole("button", { name: "Create exam" });
  await waitUntilTakenOver(create);
  await create.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Exam title" }).fill(title);
  await dialog.getByRole("button", { name: "Create exam" }).click();
  await page.waitForURL(EDITOR_PATH);
  const prompt = page.getByRole("textbox", { name: "Question 1 text" });
  await expect(prompt).toBeEditable({ timeout: readinessTimeoutMilliseconds });
  return prompt;
}

/**
 * Presses a control of the exam toolbar by its name. A control the row has no room for, as on a phone,
 * stands in the row out of sight, so it is pressed in the popover of the More control, as a teacher does.
 */
export async function pressTool(page: Page, name: string) {
  const toolbar = page.locator(TOOLBAR);
  const inRow = toolbar.getByRole("button", { exact: true, name });
  if (await inRow.isVisible()) {
    await inRow.click();
    return;
  }
  await toolbar.getByRole("button", { exact: true, name: "More" }).click();
  await page
    .locator(POPOVER)
    .getByRole("button", { exact: true, name })
    .click();
}

/** Selects the `count` characters before the caret, as a teacher does with Shift and the left arrow. */
export async function selectBack(page: Page, count: number) {
  for (let step = 0; step < count; step += 1) {
    await page.keyboard.press("Shift+ArrowLeft");
  }
}

/** The rows of the first table of a text, and the cells of its first row. */
export async function tableShape(text: Locator) {
  const rows = text.locator("table tr");
  return {
    columns: await rows.first().locator("th, td").count(),
    rows: await rows.count(),
  };
}

/**
 * Collects what a page must never show while a teacher edits: an uncaught error, an error in the
 * console, a step the editor's sync dropped, and a Convex mutation the server refused. A concurrent edit
 * or a fold is an answer of the editor's submit, never a refusal (ADR 0028).
 */
export function watchFailures(page: Page) {
  const failures = MutableList.make<string>();
  page.on("pageerror", (error) =>
    MutableList.append(failures, `page error: ${String(error)}`)
  );
  page.on("console", (message) => {
    if (
      message.type() === "error" ||
      (message.type() === "warning" && DROPPED.test(message.text()))
    ) {
      MutableList.append(
        failures,
        `console ${message.type()}: ${message.text()}`
      );
    }
  });
  page.on("websocket", (socket) => {
    if (!CONVEX_SOCKET.test(socket.url())) {
      return;
    }
    socket.on("framereceived", ({ payload }) => {
      const frame = decodeGiven(payload.toString());
      if (
        Option.isSome(frame) &&
        frame.value.type === "MutationResponse" &&
        !frame.value.success
      ) {
        MutableList.append(failures, "a Convex mutation was refused");
      }
    });
  });
  return failures;
}

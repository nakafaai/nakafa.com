import { expect, type Page, type Request, test } from "@playwright/test";
import { Effect } from "effect";
import { loadMarketingPage } from "@/e2e/support/marketing";
import {
  withObservedEvents,
  withObservedPageErrors,
} from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The demo's first question names its right answer, option C, as a teacher marks it. */
const KEY_C = "Mark option C of question 1 as correct";

/** The option a visitor marks instead. */
const KEY_A = "Mark option A of question 1 as correct";

/**
 * The School landing shows the real exam editor over a demo exam that lives in the page (owner, 9 Nov 2026:
 * the landing's editor must be the editor itself). It opens with the demo's title and its first question's key,
 * and takes a visitor's changes as it takes a teacher's: a new key, words typed into the prompt, and a new
 * question, with no request leaving the page and no error.
 */
const verifyLandingEditor = Effect.fn("NakafaE2E.verifyLandingEditor")(
  function* (page: Page) {
    yield* loadMarketingPage(page, "/en/school");
    const editor = page.locator("section#exams");
    yield* Effect.promise(() => editor.scrollIntoViewIfNeeded());

    yield* Effect.promise(() =>
      expect(editor.getByRole("textbox", { name: "Exam title" })).toHaveValue(
        "Physics midterm",
        { timeout: readinessTimeoutMilliseconds }
      )
    );
    const keyC = editor.getByRole("button", { name: KEY_C });
    yield* Effect.promise(() =>
      expect(keyC).toHaveAttribute("aria-pressed", "true")
    );

    yield* Effect.promise(() =>
      editor.getByRole("button", { name: KEY_A }).click()
    );
    yield* Effect.promise(() =>
      expect(editor.getByRole("button", { name: KEY_A })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
    );

    const prompt = editor.getByRole("textbox", { name: "Question 1 text" });
    yield* Effect.promise(() => prompt.click());
    yield* Effect.promise(() => page.keyboard.press("End"));
    yield* Effect.promise(() => page.keyboard.type(" Show your work."));
    yield* Effect.promise(() =>
      expect(prompt).toContainText("Show your work.")
    );

    yield* Effect.promise(() =>
      editor.getByRole("button", { exact: true, name: "Add question" }).click()
    );
    yield* Effect.promise(() =>
      expect(editor.getByRole("heading", { name: "Question 4" })).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      })
    );
  }
);

test("the School landing's exam editor is the real editor and takes a visitor's changes", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await Effect.runPromise(
    withObservedPageErrors(page, verifyLandingEditor(page))
  );
});

/** How far one turn of the wheel scrolls the page, in pixels. */
const WHEEL_STEP = 600;

/** The most turns of the wheel the page takes from its top to its bottom. */
const WHEEL_TURNS = 60;

/**
 * Scrolls the page from its top to its bottom with the wheel, as a reader does, so every part loads its code and
 * the demo's screens start, then waits for what they start to settle.
 */
const scrollToEnd = Effect.fn("NakafaE2E.scrollToEnd")(function* (page: Page) {
  const turn = Effect.gen(function* () {
    const atEnd = yield* Effect.promise(() =>
      page.evaluate(() => {
        const root = document.scrollingElement ?? document.documentElement;
        return root.scrollTop + window.innerHeight >= root.scrollHeight - 2;
      })
    );
    if (!atEnd) {
      yield* Effect.promise(() => page.mouse.wheel(0, WHEEL_STEP));
      yield* Effect.promise(() => page.waitForTimeout(250));
    }
    return atEnd;
  });
  yield* turn.pipe(
    Effect.repeat({ times: WHEEL_TURNS, until: (atEnd) => atEnd })
  );
  yield* Effect.promise(() => page.waitForLoadState("networkidle"));
});

/**
 * The School landing logs no error from its top to its bottom: no console error, no failed request and no page
 * error (owner, 13 Nov 2026). Its demos answer every call in the page, so none of them may open a connection, which
 * the page's Content Security Policy refuses with an error in every engine.
 */
for (const width of [390, 768, 1440]) {
  test(`the School landing logs no error from top to bottom at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await Effect.runPromise(
      withObservedEvents(
        (record) => {
          const listen = (message: {
            text: () => string;
            type: () => string;
          }) => {
            if (message.type() === "error") {
              record(`error: ${message.text()}`);
            }
          };
          const failed = (request: Request) =>
            record(`failed: ${request.url()}`);
          page.on("console", listen);
          page.on("requestfailed", failed);
          return () => {
            page.off("console", listen);
            page.off("requestfailed", failed);
          };
        },
        (said) =>
          withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* loadMarketingPage(page, "/en/school");
              yield* scrollToEnd(page);
              expect(yield* said).toEqual([]);
            })
          )
      )
    );
  });
}

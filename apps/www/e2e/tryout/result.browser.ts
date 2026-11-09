import { expect, type Locator, type Page, test } from "@playwright/test";
import { seedXendit } from "@repo/backend/scripts/content/acceptance/xendit";
import { Array as Arr, Effect, Option, Order } from "effect";
import { runFixture } from "@/e2e/support/acceptance";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import {
  entrySetHref,
  finishEntryAttempt,
  startEntryAttempt,
} from "@/e2e/support/entry";
import { activate } from "@/e2e/support/input";
import {
  chooseView,
  questionArticle,
  questionHeading,
  shownQuestions,
} from "@/e2e/support/player";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  desktopViewport,
  touchViewport,
  viewportSize,
} from "@/e2e/support/viewport";

/** The question a seat jumps to: far enough down that the page must scroll to it. */
const JUMP = 12;

/** The name of the result's pane, its sheet and its landmark. */
const RESULT = "Your result";

/** The name of question 1's seat once the attempt that answered it is graded. */
const FIRST_GRADED = /^Question 1, (?:correct|wrong)$/u;

/** The name of the button that opens the result's sheet on a phone. */
const OPENER = /^Open your result, /u;

/** The browser storage key of the width of the player's pane. */
const PANE_WIDTH_KEY = "nakafa-pane-player";

/** The global that counts the writes of the pane's width while the test watches. */
const WRITES = "__nakafaPaneWidthWrites";

/** The global that holds the time between frames while the test watches. */
const FRAMES = "__nakafaFrameGaps";

/** The global that holds what each frame of a hard load drew of the set's card and action. */
const FIRST_FRAMES = "__nakafaFirstFrames";

/**
 * Takes one attempt of the entry set, picks the first option of question 1 when `answer` asks for it, and
 * finishes the attempt, so its review shows.
 */
const takeAttempt = Effect.fn("NakafaE2E.takeResultAttempt")(function* (
  page: Page,
  action: string,
  primary: string,
  answer: boolean,
  hasTouch: boolean
) {
  yield* startEntryAttempt(page, action, primary);
  if (answer) {
    const option = questionArticle(page, 1).getByRole("radio").first();
    yield* activate(option, hasTouch);
    yield* Effect.promise(() => expect(option).toBeChecked());
  }
  yield* finishEntryAttempt(page);
});

/**
 * How far an element's top stands below the bottom edge of the page's sticky header, in pixels. A Promise,
 * because a poll that waits for a scroll to land needs one.
 */
async function clearanceOf(page: Page, target: Locator) {
  const header = await page
    .locator("[data-slot=page-header]")
    .first()
    .boundingBox();
  const box = await target.boundingBox();
  return box === null || header === null
    ? Number.NEGATIVE_INFINITY
    : box.y - (header.y + header.height);
}

/** The question number the page's address names, or none. */
const addressedQuestion = (page: Page) =>
  new URL(page.url()).searchParams.get("question");

/** The middle value of some numbers, or 0 for none. */
const median = (values: readonly number[]) =>
  Option.getOrElse(
    Arr.get(Arr.sort(values, Order.Number), Math.floor(values.length / 2)),
    () => 0
  );

/**
 * Counts each write of the pane's width to the browser's storage, and records the time between frames,
 * from the moment it is called. The script runs in the page, so it uses the browser's own APIs.
 */
const watchPane = (page: Page) =>
  Effect.promise(() =>
    page.evaluate(
      ({ frames, key, writes }) => {
        Reflect.set(window, writes, 0);
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name: string, value: string) {
          if (name === key) {
            Reflect.set(window, writes, Reflect.get(window, writes) + 1);
          }
          setItem.call(this, name, value);
        };
        const gaps: number[] = [];
        Reflect.set(window, frames, gaps);
        let last = performance.now();
        const sample = (now: number) => {
          gaps.push(now - last);
          last = now;
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      },
      { frames: FRAMES, key: PANE_WIDTH_KEY, writes: WRITES }
    )
  );

/** Reads the frame gaps recorded since the last call, and starts the next count. */
const takeFrameGaps = (page: Page) =>
  Effect.promise(() =>
    page.evaluate<readonly number[], string>((frames) => {
      const gaps: number[] = Reflect.get(window, frames);
      return gaps.splice(0, gaps.length);
    }, FRAMES)
  );

/** How many times the pane's width was written to storage since `watchPane`. */
const paneWrites = (page: Page) =>
  page.evaluate<number, string>(
    (writes) => Reflect.get(window, writes),
    WRITES
  );

test.describe("The result of a finished try-out", () => {
  // Each test runs and finishes the set before its review shows.
  test.describe.configure({ timeout: 300_000 });

  test.describe("on desktop", () => {
    test.use({ viewport: viewportSize(desktopViewport) });

    test("stands in a pane with its facts, its verdicts and its footer, sends a seat's question below the header, keeps it through a reload, shows it alone, and drags its edge without work per move", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { learner } = yield* openChatPage(page, origin);
          yield* runFixture(seedXendit(learner.userId, "plan"));
          yield* Effect.promise(() =>
            page.goto(entrySetHref, { waitUntil: "commit" })
          );
          yield* takeAttempt(page, "Start", "Start", true, false);

          // The pane: its header, its four facts, a verdict on every seat, and its footer.
          const pane = page.getByRole("complementary", { name: RESULT });
          yield* Effect.promise(async () => {
            await expect(pane).toBeVisible({
              timeout: readinessTimeoutMilliseconds,
            });
            await expect(
              pane.getByRole("heading", { exact: true, name: RESULT })
            ).toBeVisible();
            for (const fact of ["Correct answers", "Time used", "Time limit"]) {
              await expect(pane.getByText(fact, { exact: true })).toBeVisible();
            }
            await expect(
              pane.getByRole("button", {
                name: FIRST_GRADED,
              })
            ).toBeVisible();
            await expect(
              pane.getByRole("button", {
                exact: true,
                name: "Question 2, unanswered",
              })
            ).toBeVisible();
            await expect(
              pane.getByText("Green is correct, red is wrong.")
            ).toBeVisible();
            await expect(
              pane.getByRole("button", { exact: true, name: "Explanation" })
            ).toBeEnabled();
          });

          // A seat sends its question below the sticky header, and the address names it.
          yield* activate(
            pane.getByRole("button", {
              name: new RegExp(`^Question ${JUMP},`, "u"),
            }),
            false
          );
          yield* Effect.promise(async () => {
            await expect
              .poll(() => clearanceOf(page, questionHeading(page, JUMP)))
              .toBeGreaterThanOrEqual(8);
            await expect.poll(() => addressedQuestion(page)).toBe(String(JUMP));
          });

          // A reload opens the same question, below the header, with its seat current.
          yield* Effect.promise(async () => {
            await page.reload({ waitUntil: "commit" });
            await expect(
              pane.getByRole("button", {
                name: new RegExp(`^Question ${JUMP},`, "u"),
              })
            ).toHaveAttribute("aria-current", "step", {
              timeout: readinessTimeoutMilliseconds,
            });
            await expect
              .poll(() => clearanceOf(page, questionHeading(page, JUMP)))
              .toBeGreaterThanOrEqual(8);
          });

          // A drag of the pane's edge writes its width once, when it lets go, and its frames stay near idle.
          const edge = pane.getByRole("separator", { name: "Change width" });
          yield* watchPane(page);
          yield* Effect.sleep("1 second");
          const idle = yield* takeFrameGaps(page);
          const grip = yield* Effect.promise(() => edge.boundingBox()).pipe(
            Effect.flatMap(Effect.fromNullishOr)
          );
          yield* Effect.promise(async () => {
            const y = grip.y + grip.height / 2;
            await page.mouse.move(grip.x + grip.width / 2, y);
            await page.mouse.down();
            for (const step of Arr.range(1, 30)) {
              await page.mouse.move(grip.x - step * 8, y);
            }
            expect(await paneWrites(page)).toBe(0);
            await expect(page.locator("html")).toHaveAttribute(
              "data-resizing",
              ""
            );
          });
          const dragged = yield* takeFrameGaps(page);
          yield* Effect.promise(async () => {
            await page.mouse.up();
            await expect.poll(() => paneWrites(page)).toBe(1);
            await expect(page.locator("html")).not.toHaveAttribute(
              "data-resizing",
              ""
            );
          });
          // The numbers the pull request reports, against the 83 ms median measured on production.
          yield* Effect.log(
            `idle median ${String(median(idle))} ms, drag median ${String(median(dragged))} ms over ${dragged.length} frames`
          );

          // One question at a time shows the current one alone, Next moves on, and the address follows.
          yield* chooseView(page, false, "One question");
          yield* Effect.promise(async () => {
            await expect(shownQuestions(page)).toHaveCount(1, {
              timeout: readinessTimeoutMilliseconds,
            });
            await expect(questionArticle(page, JUMP)).toBeVisible();
          });
          yield* activate(
            page.getByRole("button", { exact: true, name: "Next question" }),
            false
          );
          yield* Effect.promise(async () => {
            await expect(questionArticle(page, JUMP + 1)).toBeVisible();
            await expect
              .poll(() => addressedQuestion(page))
              .toBe(String(JUMP + 1));
          });

          // The footer opens the current question's explanation.
          yield* activate(
            pane.getByRole("button", { exact: true, name: "Explanation" }),
            false
          );
          yield* Effect.promise(() =>
            expect(
              questionArticle(page, JUMP + 1).getByRole("heading", {
                name: "Explanation",
              })
            ).toBeVisible()
          );
        })
      );
    });

    test("draws no empty card and no nameless action in a signed-in learner's first frames of a set", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          yield* openChatPage(page, origin);
          yield* Effect.promise(() =>
            page.addInitScript((key) => {
              const frames: { blankAction: boolean; emptyCard: boolean }[] = [];
              Object.defineProperty(window, key, { value: frames });
              const shown = (element: Element | null) =>
                element?.checkVisibility({ checkVisibilityCSS: true }) ?? false;
              const sample = () => {
                const action =
                  document.querySelector("main [data-slot=tryout-action-name]")
                    ?.parentElement ?? null;
                const card = document.querySelector("main section.bg-card");
                const named = (element: Element | null) =>
                  [...(element?.querySelectorAll("*") ?? [])].some(
                    (child) =>
                      child.children.length === 0 &&
                      (child.textContent ?? "").trim() !== "" &&
                      child.checkVisibility({ checkVisibilityCSS: true })
                  );
                frames.push({
                  blankAction: shown(action) && !named(action),
                  emptyCard: shown(card) && !named(card),
                });
                requestAnimationFrame(sample);
              };
              requestAnimationFrame(sample);
            }, FIRST_FRAMES)
          );
          yield* Effect.promise(async () => {
            await page.goto(entrySetHref, { waitUntil: "commit" });
            await expect(
              page
                .locator("main")
                .getByRole("button", { exact: true, name: "Start" })
            ).toBeEnabled({ timeout: readinessTimeoutMilliseconds });
          });
          const frames = yield* Effect.promise(() =>
            page.evaluate<
              readonly { blankAction: boolean; emptyCard: boolean }[],
              string
            >((key) => Reflect.get(window, key), FIRST_FRAMES)
          );
          yield* Effect.sync(() => {
            expect(frames.length).toBeGreaterThan(0);
            expect(Arr.filter(frames, (frame) => frame.blankAction)).toEqual(
              []
            );
            expect(Arr.filter(frames, (frame) => frame.emptyCard)).toEqual([]);
          });
        })
      );
    });
  });

  test.describe("on a phone", () => {
    test.use({
      hasTouch: touchViewport.hasTouch,
      viewport: viewportSize(touchViewport),
    });

    test("opens the result from a bar that stays at the bottom of the screen, and a seat there sends its question below the header", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { learner } = yield* openChatPage(page, origin);
          yield* runFixture(seedXendit(learner.userId, "plan"));
          yield* Effect.promise(() =>
            page.goto(entrySetHref, { waitUntil: "commit" })
          );
          yield* takeAttempt(page, "Start", "Start", true, true);

          const opener = page.getByRole("button", {
            name: OPENER,
          });
          yield* Effect.promise(async () => {
            await expect(opener).toBeVisible({
              timeout: readinessTimeoutMilliseconds,
            });
            await page.evaluate(() =>
              window.scrollTo({
                behavior: "instant",
                top: document.documentElement.scrollHeight,
              })
            );
            const box = await opener.boundingBox();
            expect(box).not.toBeNull();
            expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
              touchViewport.height
            );
            await expect(
              page.locator("main article").getByRole("button", { name: OPENER })
            ).toHaveCount(0);
          });
          yield* activate(opener, true);
          const sheet = page.getByRole("dialog", { name: RESULT });
          yield* Effect.promise(() => expect(sheet).toBeVisible());
          yield* activate(
            sheet.getByRole("button", {
              name: new RegExp(`^Question ${JUMP},`, "u"),
            }),
            true
          );
          yield* Effect.promise(async () => {
            await expect(sheet).toBeHidden();
            await expect
              .poll(() => clearanceOf(page, questionHeading(page, JUMP)))
              .toBeGreaterThanOrEqual(8);
          });
        })
      );
    });
  });
});

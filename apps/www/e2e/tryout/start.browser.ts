import { expect, type Page, type Route, test } from "@playwright/test";
import de from "@repo/internationalization/dictionaries/de.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import id from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import { Array as Arr, Effect, MutableList, Option, Schema } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { CONVEX_SOCKET } from "@/e2e/support/frames";
import { activate } from "@/e2e/support/input";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { waitForRunningSection } from "@/e2e/support/player";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { tryoutViewports } from "@/e2e/support/viewport";
import { waitUntilTakenOver } from "@/e2e/support/window";

const FRAMES_KEY = "nakafaStartFrames";
const NAMES_KEY = "nakafaActionNames";

/** The set of the sections below, whose start lands on its first section. */
const SET_HREF = "/en/try-out/indonesia/snbt/2027/set-1";

/** An address that names a running attempt. */
const ATTEMPT_ADDRESS = /attemptId=/u;

/** The cell that holds a try-out action's names, whichever of them shows. */
const ACTION_NAME = "main [data-slot=tryout-action-name]";

/** A try-out action, found by its cell: a learner's has no name until their read answers. */
const ACTION = `main :is(a, button):has(${ACTION_NAME})`;

/** Every script of the page, held back so a press lands before React takes the page over. */
const SCRIPTS = /\/assets\/.*\.js/u;

/**
 * The first section of SNBT 2027 set 1 in each locale, at its own address: a set and a section have their own
 * slug in each locale, and the section's title names the page.
 */
const SECTIONS = [
  {
    href: "/en/try-out/indonesia/snbt/2027/set-1/general-reasoning",
    messages: en,
    title: "General Reasoning",
  },
  {
    href: "/id/try-out/indonesia/snbt/2027/set-1/penalaran-umum",
    messages: id,
    title: "Penalaran Umum",
  },
  {
    href: "/de/try-out/indonesien/snbt/2027/aufgabensatz-1/allgemeines-schlussfolgern",
    messages: de,
    title: "Allgemeines Schlussfolgern",
  },
] as const;

/** One animation frame after the page loaded, as the page recorded it. */
const StartFrame = Schema.Struct({
  /** A dialog shows. */
  dialog: Schema.Boolean,
  /** The shell is locked, as the player's page holds it. */
  locked: Schema.Boolean,
  /** The player's first question shows. */
  question: Schema.Boolean,
  time: Schema.Finite,
  /** The player's timer shows: the frame the press opens and the running player both draw it. */
  timer: Schema.Boolean,
});

/** Every frame since the page loaded, and the moment the learner confirmed the start. */
const StartFrames = Schema.Struct({
  confirmedAt: Schema.mutableKey(Schema.NullOr(Schema.Finite)),
  frames: Schema.mutable(Schema.Array(StartFrame)),
});

/**
 * Records every animation frame from the first script on: whether a dialog, the player's timer and its first
 * question show, and whether the shell is locked; and the moment a press inside the dialog confirms. The
 * script runs in the page, so it uses the browser's own APIs.
 */
const recordStartFrames = Effect.fn("NakafaE2E.recordStartFrames")(function* (
  page: Page
) {
  yield* Effect.promise(() =>
    page.addInitScript((key) => {
      const samples: typeof StartFrames.Type = {
        confirmedAt: null,
        frames: [],
      };
      Object.defineProperty(window, key, { value: samples });
      document.addEventListener(
        "click",
        (event) => {
          if (
            event.target instanceof Element &&
            event.target.closest("[role=dialog] button") !== null
          ) {
            samples.confirmedAt = performance.now();
          }
        },
        true
      );
      const visibility = { checkOpacity: true, checkVisibilityCSS: true };
      const shows = (selector: string) =>
        [...document.querySelectorAll(selector)].some((element) =>
          element.checkVisibility(visibility)
        );
      const sample = () => {
        samples.frames.push({
          dialog: shows("[role=dialog]"),
          locked:
            document
              .querySelector("[data-slot=sidebar-wrapper]")
              ?.matches("[data-locked], :has([data-shell-lock])") ?? false,
          question: shows("#exercise-question-1"),
          time: performance.now(),
          timer: shows("main [role=timer]"),
        });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, FRAMES_KEY)
  );
});

/**
 * Opens a section's own page signed in, presses its Start and confirms the start once, then requires the
 * player in the frame after the press: the dialog gone and the player's frame drawn within two frames, the
 * shell locked and the player on screen in every frame after it, and the first question once the server
 * has started the attempt and its section. The timings go to the test's report as an attachment.
 */
const verifyOnePress = Effect.fn("NakafaE2E.verifyOnePressStart")(function* (
  page: Page,
  hasTouch: boolean,
  baseURL: string,
  section: (typeof SECTIONS)[number]
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* signInLearner(page.context(), baseURL);
  yield* recordStartFrames(page);
  yield* Effect.promise(() => page.goto(section.href, { waitUntil: "commit" }));
  const start = page.locator("main").getByRole("button", {
    exact: true,
    name: section.messages.Tryouts["start-cta"],
  });
  yield* Effect.promise(() =>
    expect(start).toBeEnabled({ timeout: readinessTimeoutMilliseconds })
  );
  yield* Effect.promise(() => waitUntilTakenOver(start));
  yield* activate(start, hasTouch);
  yield* activate(
    page.getByRole("dialog").getByRole("button", {
      exact: true,
      name: section.messages.Tryouts["free-cta"],
    }),
    hasTouch
  );
  yield* waitForRunningSection(page);
  yield* Effect.promise(() =>
    expect(
      page
        .locator("main")
        .getByRole("heading", { level: 1, name: section.title })
    ).toBeVisible()
  );
  yield* Effect.sync(() => {
    const address = new URL(page.url());
    expect(address.pathname).toBe(section.href);
    expect(address.searchParams.has("attemptId")).toBe(true);
  });

  const samples = yield* Effect.promise(() =>
    page.evaluate((key) => Reflect.get(window, key), FRAMES_KEY)
  ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(StartFrames)));
  const confirmedAt = yield* Effect.fromNullishOr(samples.confirmedAt);
  const after = Arr.filter(samples.frames, (frame) => frame.time > confirmedAt);
  const firstAt = (shown: (frame: typeof StartFrame.Type) => boolean) =>
    Arr.findFirst(after, shown).pipe(
      Option.map((frame) => Math.round(frame.time - confirmedAt))
    );
  const closedIn = firstAt((frame) => !frame.dialog);
  const playerIn = firstAt((frame) => frame.timer);
  const questionIn = firstAt((frame) => frame.question);
  yield* Effect.promise(() =>
    test.info().attach("timing", {
      body: `dialog closed in ${Option.getOrUndefined(closedIn)} ms, player frame in ${Option.getOrUndefined(playerIn)} ms, question 1 in ${Option.getOrUndefined(questionIn)} ms`,
      contentType: "text/plain",
    })
  );
  yield* Effect.sync(() => {
    // The second frame after the press at the latest, so no frame waits on the server.
    const frames = Arr.take(after, 2);
    expect(Arr.some(frames, (frame) => !frame.dialog)).toBe(true);
    expect(Arr.some(frames, (frame) => frame.timer)).toBe(true);
    // From the player's first frame on, the player and the locked shell stay on screen.
    const shown = Arr.dropWhile(after, (frame) => !frame.timer);
    expect(Arr.every(shown, (frame) => frame.timer && frame.locked)).toBe(true);
    expect(Option.isSome(questionIn)).toBe(true);
  });
});

for (const viewport of tryoutViewports) {
  for (const section of SECTIONS) {
    test.describe(`One-press try-out start on ${viewport.name}`, () => {
      test.use({
        hasTouch: viewport.hasTouch,
        viewport: { height: viewport.height, width: viewport.width },
      });

      test(`opens the player of ${section.href} with one press`, async ({
        baseURL,
        page,
      }) => {
        await Effect.runPromise(
          withObservedPageErrors(
            page,
            Effect.fromNullishOr(baseURL).pipe(
              Effect.flatMap((origin) =>
                verifyOnePress(page, viewport.hasTouch, origin, section)
              )
            )
          )
        );
      });
    });
  }
}

/**
 * A slow phone paints the start button seconds before the page can act. A learner's
 * press in that moment shows the loader, and the confirmation opens once the page's
 * client and its reads arrive, so the press is never lost.
 */
test("a press on the start before the page can act opens the confirmation", async ({
  baseURL,
  page,
}) => {
  const section = SECTIONS[0];
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        const origin = yield* Effect.fromNullishOr(baseURL);
        yield* seedAnalyticsConsent(page, "denied");
        yield* signInLearner(page.context(), origin);
        yield* Effect.promise(async () => {
          const held = MutableList.make<Route>();
          await page.route(SCRIPTS, (route) => {
            MutableList.append(held, route);
          });
          await page.goto(section.href, { waitUntil: "domcontentloaded" });
          await page.locator(ACTION).click();
          for (const route of MutableList.toArray(held)) {
            await route.continue();
          }
          await page.unroute(SCRIPTS);
          await expect(
            page.getByRole("dialog").getByRole("button", {
              exact: true,
              name: section.messages.Tryouts["free-cta"],
            })
          ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
        });
      })
    )
  );
});

/**
 * Records each name the page's try-out action shows, from the first frame on: an empty name is an action
 * still waiting for the learner read. The script runs in the page, so it uses the browser's own APIs.
 */
const recordActionNames = Effect.fn("NakafaE2E.recordActionNames")(function* (
  page: Page,
  selector: string
) {
  yield* Effect.promise(() =>
    page.addInitScript(
      ([key, cell]) => {
        const names: string[] = [];
        Object.defineProperty(window, key, { value: names });
        const sample = () => {
          const shown = document.querySelector(cell);
          if (shown !== null) {
            const name =
              [...shown.children].find((child) =>
                child.checkVisibility({ checkVisibilityCSS: true })
              )?.textContent ?? "";
            if (names.at(-1) !== name) {
              names.push(name);
            }
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      },
      [NAMES_KEY, selector]
    )
  );
});

/**
 * No first paint knows a learner's attempt, and a set whose attempt runs resumes it, so its action must never
 * say Start: this browser read the attempt on the way here, so the set says Continue from its first frame.
 */
test("a hard load of a set whose attempt runs never reads Start", async ({
  baseURL,
  page,
}) => {
  const messages = en.Tryouts;
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        const origin = yield* Effect.fromNullishOr(baseURL);
        yield* seedAnalyticsConsent(page, "denied");
        yield* signInLearner(page.context(), origin);
        yield* recordActionNames(page, ACTION_NAME);
        yield* Effect.promise(async () => {
          await page.goto(SET_HREF, { waitUntil: "commit" });
          const start = page.locator("main").getByRole("button", {
            exact: true,
            name: messages["start-cta"],
          });
          await expect(start).toBeEnabled({
            timeout: readinessTimeoutMilliseconds,
          });
          await waitUntilTakenOver(start);
          await start.click();
          await page
            .getByRole("dialog")
            .getByRole("button", { exact: true, name: messages["free-cta"] })
            .click();
          await page.waitForURL(ATTEMPT_ADDRESS);

          await page.goto(SET_HREF, { waitUntil: "commit" });
          await expect(
            page.locator("main").getByRole("link", {
              exact: true,
              name: messages["continue-cta"],
            })
          ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
        });
        const names = yield* Effect.promise(() =>
          page.evaluate((key) => Reflect.get(window, key), NAMES_KEY)
        ).pipe(
          Effect.flatMap(
            Schema.decodeUnknownEffect(Schema.Array(Schema.String))
          )
        );
        yield* Effect.sync(() => {
          expect(names).toEqual([messages["continue-cta"]]);
        });
      })
    )
  );
});

/**
 * The read that a press waits for brings the attempt, which keys a new tree and takes the place of the
 * button that was pressed. The press stays, and the section starts from it. The socket's answers wait
 * through the press, so the press lands while the read is pending.
 */
test("a press while the learner read is pending starts the section it brings", async ({
  baseURL,
  page,
}) => {
  const section = SECTIONS[0];
  const messages = section.messages.Tryouts;
  let holding = false;
  const held = MutableList.make<() => void>();
  await page.routeWebSocket(CONVEX_SOCKET, (socket) => {
    const server = socket.connectToServer();
    server.onMessage((message) => {
      if (holding) {
        MutableList.append(held, () => socket.send(message));
        return;
      }
      socket.send(message);
    });
  });
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        const origin = yield* Effect.fromNullishOr(baseURL);
        yield* seedAnalyticsConsent(page, "denied");
        yield* signInLearner(page.context(), origin);
        yield* Effect.promise(async () => {
          await page.goto(SET_HREF, { waitUntil: "commit" });
          const start = page.locator("main").getByRole("button", {
            exact: true,
            name: messages["start-cta"],
          });
          await expect(start).toBeEnabled({
            timeout: readinessTimeoutMilliseconds,
          });
          await waitUntilTakenOver(start);
          await start.click();
          await page
            .getByRole("dialog")
            .getByRole("button", { exact: true, name: messages["free-cta"] })
            .click();
          await page.waitForURL(ATTEMPT_ADDRESS);

          holding = true;
          await page.goto(section.href, { waitUntil: "commit" });
          await page.locator(ACTION).click();
          holding = false;
          for (const answer of MutableList.toArray(held)) {
            answer();
          }
        });
        yield* waitForRunningSection(page);
      })
    )
  );
});

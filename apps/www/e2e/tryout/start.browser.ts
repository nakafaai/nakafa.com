import { expect, type Page, test } from "@playwright/test";
import de from "@repo/internationalization/dictionaries/de.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import id from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import { Array as Arr, Effect, Option, Schema } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { activate } from "@/e2e/support/input";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { waitForRunningSection } from "@/e2e/support/player";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { tryoutViewports } from "@/e2e/support/viewport";
import { waitUntilTakenOver } from "@/e2e/support/window";

const FRAMES_KEY = "nakafaStartFrames";

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

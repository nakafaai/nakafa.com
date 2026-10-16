import {
  type BrowserContext,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import { Effect, MutableRef, Option, Schema } from "effect";
import { AI_STORAGE_KEY } from "@/components/ai/store/create";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForSlide } from "@/e2e/support/layout";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import type { ServedMessage } from "@/e2e/support/query";
import { SHEET_POPUP } from "@/e2e/support/selector";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { exchange, type Part } from "@/e2e/support/transcript/message";
import { CHAT, serveConversation } from "@/e2e/support/transcript/serve";
import { serveIcons } from "@/e2e/support/transcript/web";

/** The question that every fixture conversation starts from. */
const QUESTION = "Tolong bantu?";

/**
 * A page that carries the button that opens Nina's sheet in every language of
 * the site. The local runtime has its lessons in English only, and the first
 * surah is the lightest page of the Quran.
 */
const SHEET_PAGE = "quran/1";

/** The button that opens Nina's sheet, named in each language of the site. */
const ASK_NINA = /^(Ask Nina|Tanya Nina|Nina fragen)$/u;

/** The button that declines usage data, named in each language of the site. */
const DECLINE = /^(Decline|Tolak|Ablehnen)$/u;

/** The sections of a reply: the work Nina did, and the answer with the sources after it. */
const REPLY = '[data-slot="message-activity"], [data-slot="message-response"]';

/** More parts than any fixture conversation has, so a stuck page stops the loop. */
const MOST_PARTS = 40;

/** How long a page may take to ask a signed-in learner about usage data. */
const PROMPT_MILLISECONDS = 6000;

/** A control that opens or closes a part of the evidence, and is closed now. */
const CLOSED =
  '[data-slot="collapsible-trigger"]:not([data-panel-open]):not([aria-disabled="true"])';

/** The cookies of a browser context. */
type Cookies = Awaited<ReturnType<BrowserContext["cookies"]>>;

/**
 * The session cookies of the learner this worker signed in. A learner costs a
 * command against the local backend, which a loaded machine answers too late,
 * and no test changes the learner, since the conversation is the fixture's. So
 * the first test of the worker signs a learner in, and the tests after it take
 * that learner's session.
 */
const session = MutableRef.make<Option.Option<Cookies>>(Option.none());

/**
 * Declines usage data when the page asks. A page asks a signed-in learner once
 * its session has answered, which is after it first shows, so the prompt may
 * come late, and it may not come at all.
 */
const declineIfAsked = Effect.fn("NakafaE2E.declineIfAsked")(function* (
  page: Page
) {
  yield* Effect.tryPromise(async () => {
    const decline = page.getByRole("button", { name: DECLINE });
    await decline.click({ timeout: PROMPT_MILLISECONDS });
    await expect(decline).toBeHidden({ timeout: PROMPT_MILLISECONDS });
  }).pipe(Effect.ignore);
});

/**
 * Serves the conversation that the returned reference holds, and signs a
 * learner in. Pages that open afterwards show whatever the reference holds then.
 * The `stream` it returns puts new messages in front of a page that is open.
 */
export const startTranscript = Effect.fn("NakafaE2E.startTranscript")(
  function* (page: Page, baseURL: string) {
    const shown = MutableRef.make<readonly ServedMessage[]>([]);
    yield* seedAnalyticsConsent(page, "denied");
    yield* serveIcons(page);
    const served = yield* serveConversation(page, shown);
    const cookies = MutableRef.get(session);
    if (Option.isSome(cookies)) {
      yield* Effect.promise(() => page.context().addCookies(cookies.value));
      return { shown, stream: served.stream };
    }
    yield* signInLearner(page.context(), baseURL);
    MutableRef.set(
      session,
      Option.some(yield* Effect.promise(() => page.context().cookies()))
    );
    return { shown, stream: served.stream };
  }
);

/**
 * A phone draws its scrollbars over the page and gives them no room. The root
 * of the site keeps a gutter for scrollbars that take room, as they do in the
 * runner's browser: on both edges, and on one edge under 24rem
 * (`scrollbar-gutter` in `globals.css`). The scroller of a transcript keeps one
 * too. Those gutters narrow every column. Measured in CI on 13 October, while
 * the root kept two at that width: at a width of 320 the column of the
 * activity was 217 pixels, where it is 247 on a machine whose scrollbars lie
 * over the page as a phone's do. The chat page of a narrow width is a phone's,
 * so every box on it takes its scrollbar room back.
 */
const OVERLAY_SCROLLBARS =
  "* { scrollbar-gutter: auto !important; scrollbar-width: none !important; }";

/**
 * Shows `messages` on the chat page, in the language of `locale`. The prompt
 * for usage data is fixed to the bottom of a narrow page, where it covers the
 * rows that a test presses, so the page is shown without it.
 */
export const showChat = Effect.fn("NakafaE2E.showChat")(function* (
  page: Page,
  shown: MutableRef.MutableRef<readonly ServedMessage[]>,
  locale: string,
  messages: readonly ServedMessage[]
) {
  MutableRef.set(shown, messages);
  yield* Effect.promise(() => page.goto(`/${locale}/chat/${CHAT}`));
  yield* Effect.promise(() =>
    page.addStyleTag({ content: OVERLAY_SCROLLBARS })
  );
  yield* Effect.promise(() =>
    expect(page.locator(REPLY).first()).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* declineIfAsked(page);
  return page.locator("main");
});

/**
 * Shows `messages` in Nina's sheet on a page that carries its button. The
 * sheet opens the chat the learner had open last, which the browser remembers.
 */
const showSheet = Effect.fn("NakafaE2E.showSheet")(function* (
  page: Page,
  shown: MutableRef.MutableRef<readonly ServedMessage[]>,
  locale: string,
  messages: readonly ServedMessage[]
) {
  MutableRef.set(shown, messages);
  yield* Effect.promise(() =>
    page.addInitScript(
      ({ chat, key }) =>
        localStorage.setItem(
          key,
          JSON.stringify({ state: { activeChatId: chat }, version: 1 })
        ),
      { chat: CHAT, key: AI_STORAGE_KEY }
    )
  );
  yield* Effect.promise(() => page.goto(`/${locale}/${SHEET_PAGE}`));
  // The prompt for usage data covers the button that opens the sheet.
  yield* declineIfAsked(page);
  yield* Effect.promise(() =>
    page.getByRole("button", { name: ASK_NINA }).click()
  );
  yield* waitForSlide(page.locator(SHEET_POPUP));
  yield* Effect.promise(() =>
    expect(page.locator(REPLY).first()).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  return page.locator(SHEET_POPUP);
});

/**
 * Opens every part of the evidence in `scope` that is closed, one at a time
 * from the top, so a part that an opening reveals is opened too. A closed part
 * is found again after each press, because a press changes which parts are
 * closed. Then it waits until the animations that end have ended, so that
 * every box is measured at rest: an icon that is still turning is wider than
 * the box that holds it.
 */
const expandAll = Effect.fn("NakafaE2E.expandEvidence")(function* (
  scope: Locator
) {
  yield* Effect.promise(async () => {
    for (let presses = 0; presses < MOST_PARTS; presses += 1) {
      const closed = scope.locator(CLOSED).first();
      if ((await closed.count()) === 0) {
        break;
      }
      await closed.click();
    }
    await scope.page().evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getComputedTiming().endTime !==
              Number.POSITIVE_INFINITY
          )
          .map((animation) => animation.finished.catch(() => undefined))
      );
    });
  });
});

/** How a conversation of one reply is shown: its language, its theme, and whether its turn still runs. */
const ShowingSchema = Schema.Struct({
  dark: Schema.optionalKey(Schema.Boolean),
  locale: Schema.String,
  running: Schema.optionalKey(Schema.Boolean),
});
type Showing = typeof ShowingSchema.Type;

/** The conversation of one question and the reply made of `parts`. */
function conversationOf(parts: readonly Part[], showing: Showing) {
  return exchange({
    order: 1,
    parts,
    question: QUESTION,
    ...(showing.running ? { running: true } : {}),
  });
}

/**
 * The body of a browser test that shows one reply of Nina on the chat page,
 * with every part of its evidence open, and runs `check` while it is open.
 * Any error the page throws meanwhile fails the test.
 */
export function onChat(
  parts: readonly Part[],
  showing: Showing,
  check: (page: Page) => Promise<void>
) {
  return async ({
    baseURL,
    page,
  }: {
    baseURL: string | undefined;
    page: Page;
  }) => {
    await page.emulateMedia({ colorScheme: showing.dark ? "dark" : "light" });
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          const origin = yield* Effect.fromNullishOr(baseURL);
          const { shown } = yield* startTranscript(page, origin);
          const scope = yield* showChat(
            page,
            shown,
            showing.locale,
            conversationOf(parts, showing)
          );
          yield* expandAll(scope);
          yield* Effect.promise(() => check(page));
        })
      )
    );
  };
}

/** The same as `onChat`, with the reply in Nina's sheet on a page that carries its button. */
export function onSheet(
  parts: readonly Part[],
  showing: Showing,
  check: (page: Page) => Promise<void>
) {
  return async ({
    baseURL,
    page,
  }: {
    baseURL: string | undefined;
    page: Page;
  }) => {
    await page.emulateMedia({ colorScheme: showing.dark ? "dark" : "light" });
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          const origin = yield* Effect.fromNullishOr(baseURL);
          const { shown } = yield* startTranscript(page, origin);
          const scope = yield* showSheet(
            page,
            shown,
            showing.locale,
            conversationOf(parts, showing)
          );
          yield* expandAll(scope);
          yield* Effect.promise(() => check(page));
        })
      )
    );
  };
}

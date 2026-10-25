import {
  expect,
  type Locator,
  type Page,
  type Request,
} from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect, MutableList, Option, Schema } from "effect";
import {
  ANSWER_MILLISECONDS,
  type Changes,
  live,
  saved,
} from "@/e2e/support/changes";
import { onThePage, openChatPage } from "@/e2e/support/chat";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { SHARE_ENTRY } from "@/lib/share/fragment";

/** The shape of a share token: 32 random bytes in URL-safe Base64, 43 characters. */
export const SHARE_TOKEN = /^[A-Za-z0-9_-]{43}$/u;
/** The title of the card a chat the viewer may not read shows, on the page and in the sheet. */
export const ACCESS_TITLE = en.Ai["private-chat-error"];
/** The description of that card, which says the chat is not available to this viewer. */
export const UNAVAILABLE_COPY = en.Ai["chat-unavailable"];
/**
 * Whether a request is a PostHog ingest call: a capture or a batch. The browser
 * sends them straight to the proxy host, so the page's origin is not the test.
 */
const isAnalyticsRequest = (url: URL) =>
  url.pathname === "/e/" || url.pathname === "/batch/";

/** The title in the header of a chat page. */
const chatTitle = (page: Page) =>
  page.locator("main main header").getByRole("heading", { level: 1 });

/** The button that opens the menu of the open chat, which only its owner has. */
const chatMenu = (page: Page) =>
  page
    .locator("main main header")
    .getByRole("button", { name: "More actions" });

/** The box where the learner writes to Nina, which only the owner has. */
const composer = (page: Page) =>
  onThePage(page).getByRole("textbox", { name: "Ask Nina anything..." });

/** The prompt a chat shows as a message. */
export const promptOf = (page: Page, text: string) =>
  page.locator('[data-slot="bubble"]').filter({ hasText: text });

/** The buttons that send a message again, which only the owner has. */
const retryButtons = (page: Page) =>
  page.getByRole("button", { name: "Retry message" });

/** What a chat page or sheet shows in place of a chat the reader cannot open. */
export const notAvailable = (scope: Page | Locator) =>
  scope.locator('[data-slot="empty"]').filter({ hasText: ACCESS_TITLE });

/** The link the dialog copied, read apart. */
export function readLink(link: string) {
  const url = new URL(link);
  return {
    fragment: url.hash,
    path: url.pathname,
    query: url.search,
    token: new URLSearchParams(url.hash.slice(1)).get(SHARE_ENTRY) ?? "",
  };
}

/** The same link, opened on the app under test: its path and its fragment. */
export function linkOn(origin: string, link: string) {
  const { fragment, path } = readLink(link);
  return `${origin}${path}${fragment}`;
}

/** Opens the share dialog of the open chat, from the menu of the chat. */
export const openShareDialog = async (page: Page) => {
  await chatMenu(page).click();
  await page.getByRole("menuitem", { name: "Share chat" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
};

/**
 * Turns sharing on from the dialog of the open chat and copies the link. The
 * dialog shows the chat as shared at once, and offers to copy once the server
 * has drawn the token. It returns what the clipboard holds afterwards.
 */
export const shareChat = async (page: Page, changes: Changes) => {
  const dialog = await openShareDialog(page);
  const before = changes.sent;
  const copy = dialog.getByRole("button", { name: "Copy link" });

  changes.hold();
  await dialog.getByRole("button", { name: "Create link" }).click();
  await expect(copy).toBeDisabled();
  changes.release();
  await expect(copy).toBeEnabled({ timeout: ANSWER_MILLISECONDS });
  await saved(changes, before);
  await copy.click();
  await expect(page.getByText("Link copied!")).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  return link;
};

/**
 * Turns sharing off from the dialog of the open chat. The dialog offers to
 * create a link again before the server has answered.
 */
export const unshareChat = async (page: Page, changes: Changes) => {
  const dialog = await openShareDialog(page);
  const before = changes.sent;

  changes.hold();
  await dialog.getByRole("button", { name: "Private" }).click();
  await expect(
    dialog.getByRole("button", { name: "Create link" })
  ).toBeVisible();
  changes.release();
  await saved(changes, before);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
};

/** Waits until a reader's page shows the chat: its title and its first prompt. */
export const readsChat = async (page: Page, title: string, prompt: string) => {
  await expect(chatTitle(page)).toHaveText(title, {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(promptOf(page, prompt)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
};

/**
 * What the owner's page offers: to write to the chat, to manage it, and to
 * send a message again. A reader's page leaves all of them out.
 */
const offersWriting = async (page: Page) => {
  await expect(composer(page)).toBeVisible();
  await expect(chatMenu(page)).toBeVisible();
  await expect(retryButtons(page).first()).toBeVisible();
};

/**
 * What a reader who is not the owner is offered of those controls: no box to
 * write to Nina, no menu to rename, share or delete the chat, and no button to
 * send a message again.
 */
export const offersNoWriting = async (page: Page) => {
  await expect(composer(page)).toHaveCount(0);
  await expect(chatMenu(page)).toHaveCount(0);
  await expect(retryButtons(page)).toHaveCount(0);
};

/**
 * A learner with a chat, open on its page, where the learner sees every
 * control of the owner. The page can read the clipboard, for the link.
 */
export const ownedChat = Effect.fn("NakafaE2E.ownedChat")(function* (
  page: Page,
  baseURL: string,
  words: { prompt: string; title: string }
) {
  yield* Effect.promise(() =>
    page.context().grantPermissions(["clipboard-read", "clipboard-write"])
  );
  const { changes, learner } = yield* openChatPage(page, baseURL);
  const chat = yield* learner.startChat(words.prompt);
  yield* learner.titleNewest([words.title]);

  yield* Effect.promise(async () => {
    await page.goto(`/en/chat/${chat.chatId}`);
    await readsChat(page, words.title, words.prompt);
    await offersWriting(page);
    await live(changes);
  });
  return { changes, chat, learner };
});

/** One analytics event, as the proxy forwards it to PostHog. */
const AnalyticsEvent = Schema.Struct({
  event: Schema.String,
  properties: Schema.Record(Schema.String, Schema.Unknown),
});
const AnalyticsBody = Schema.fromJsonString(
  Schema.Union([
    AnalyticsEvent,
    Schema.Struct({ batch: Schema.Array(AnalyticsEvent) }),
  ])
);

/**
 * Records every request a page makes, with its address and what it carries.
 * Navigations, scripts, fetches and the analytics proxy all pass through it.
 * A WebSocket carries no request, so the realtime connection to the backend is
 * not among them.
 */
export const watchRequests = (page: Page) => {
  const sent = MutableList.make<Request>();

  page.on("request", (request) => {
    MutableList.append(sent, request);
  });

  return {
    /** Whether any request carries `text` in its address or in its body. */
    carry: (text: string) =>
      Arr.some(
        MutableList.toArray(sent),
        (request) =>
          request.url().includes(text) ||
          (request.postData() ?? "").includes(text)
      ),
    /** The hosts the page talked to, each with its port. */
    hosts: () =>
      Arr.dedupe(
        Arr.map(
          MutableList.toArray(sent),
          (request) => new URL(request.url()).host
        )
      ),
    /**
     * The addresses that the page's analytics requests reported as viewed, each
     * with the status the answer to its request had, which is none while it is
     * unanswered.
     */
    pageviews: () =>
      Arr.flatMap(MutableList.toArray(sent), (request) => {
        if (!isAnalyticsRequest(new URL(request.url()))) {
          return [];
        }
        const events = Option.match(
          Schema.decodeUnknownOption(AnalyticsBody)(request.postData()),
          {
            onNone: () => [],
            onSome: (body) => ("batch" in body ? body.batch : [body]),
          }
        );
        return Arr.flatMap(events, ({ event, properties }) =>
          event === "$pageview"
            ? [
                {
                  status: request.existingResponse()?.status(),
                  url: properties.$current_url,
                },
              ]
            : []
        );
      }),
  };
};

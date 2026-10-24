import { type Browser, expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { ANSWER_MILLISECONDS, type Changes } from "@/e2e/support/changes";
import { runOnPage } from "@/e2e/support/chat";
import { withLearner, withReader } from "@/e2e/support/reader";
import { pageRows } from "@/e2e/support/rows";
import {
  linkOn,
  notAvailable,
  offersNoWriting,
  ownedChat,
  promptOf,
  readLink,
  readsChat,
  SHARE_TOKEN,
  shareChat,
  unshareChat,
  watchRequests,
} from "@/e2e/support/share";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  learnsNoStreamAndNoMemory,
  learnsNothingOfWhoOwnsTheChat,
  learnsOnlyWhereTurnsStand,
  learnsWhatTurnsCost,
  learnsWhoOwnsTheChat,
} from "@/e2e/support/told";

const PROMPT = "Why is the derivative of sine the cosine?";
const TITLE = "The derivative of sine";

/** The link the dialog copies: the locale and the chat id in the path, and a token of 43 characters in the fragment. */
const copiesALink = Effect.fn("NakafaE2E.copiesALink")(function* (
  page: Page,
  changes: Changes,
  chatId: string
) {
  const link = yield* Effect.promise(() => shareChat(page, changes));
  const { fragment, path, query, token } = readLink(link);

  yield* Effect.sync(() => {
    expect(path).toBe(`/en/chat/${chatId}`);
    expect(query).toBe("");
    expect(token).toMatch(SHARE_TOKEN);
    expect(fragment).toBe(`#share=${token}`);
  });
  return { link, token };
});

/**
 * A reader opens the link in a new load of the page: the transcript is there,
 * and none of the controls that write. The document is marked, so a later step
 * can tell whether the page was reloaded.
 */
const readsByLink = (
  reader: Page,
  origin: string,
  link: string,
  chatId: string
) =>
  Effect.promise(async () => {
    await reader.goto(linkOn(origin, link));
    await expect(reader).toHaveURL(new RegExp(`/en/chat/${chatId}#share=`));
    await readsChat(reader, TITLE, PROMPT);
    await offersNoWriting(reader);
    await reader.evaluate(() => Reflect.set(window, "kept", true));
  });

/**
 * A reader opens an address that gets them no chat. The page they get is the
 * one a chat that cannot be opened gets, and its words are returned.
 */
const meetsNothing = (reader: Page, address: string) =>
  Effect.promise(async () => {
    await reader.goto(address);
    await expect(notAvailable(reader)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(promptOf(reader, PROMPT)).toHaveCount(0);
    return notAvailable(reader).innerText();
  });

/**
 * A reader's page loses the chat once the owner stops sharing, and it is the
 * same document: the page asked the server again, and was not reloaded.
 */
const losesTheChat = (reader: Page) =>
  Effect.promise(async () => {
    await expect(notAvailable(reader)).toBeVisible({
      timeout: ANSWER_MILLISECONDS,
    });
    await expect(promptOf(reader, PROMPT)).toHaveCount(0);
    expect(await reader.evaluate(() => Reflect.get(window, "kept"))).toBe(true);
  });

/**
 * The learners' chats pages: no profile is public, so another learner finds
 * the page not there, and the owner's lists the shared chat.
 */
const profilesShowOnlyTheOwn = (
  owner: Page,
  member: Page,
  ownerUsername: string
) =>
  Effect.promise(async () => {
    // The proxy answers it as a real 404 before the page renders. The Start server
    // draws the framework's own 404 for a rewritten address, so only the status is
    // the contract here.
    const answer = await member.goto(`/en/@${ownerUsername}/chat`);
    expect(answer?.status()).toBe(404);
    await expect(pageRows(member)).toHaveCount(0);
    await owner.goto(`/en/@${ownerUsername}/chat`);
    // A row is the link that covers it and its words beside it, so the test reads their parent.
    const rows = pageRows(owner).locator("xpath=..");
    await expect(rows).toHaveCount(1, {
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(rows).toContainText(TITLE);
  });

/**
 * The whole life of a share link, for a reader with no account and one with
 * another account. The owner shares a chat, stops, and shares again.
 */
const sharesAndStops = Effect.fn("NakafaE2E.sharesAndStops")(function* (
  browser: Browser,
  page: Page,
  origin: string
) {
  const owner = yield* ownedChat(page, origin, {
    prompt: PROMPT,
    title: TITLE,
  });
  const { chatId } = owner.chat;
  // A chat that existed once, for the page that a chat that is not there gets.
  const gone = yield* owner.learner.startChat("A chat to delete");
  yield* owner.learner.deleteChat(gone.chatId);

  // 1. The dialog gives a link whose fragment holds the token.
  const first = yield* copiesALink(page, owner.changes, chatId);

  yield* withReader(browser, origin, (reader, readerChanges) =>
    withLearner(browser, origin, (member, memberChanges) =>
      Effect.gen(function* () {
        const requests = watchRequests(reader);
        // The learner's own change, their decision about analytics, is stored by now.
        const memberSent = memberChanges.sent;

        // 2. A reader with no session reads the chat, with no control to write.
        yield* readsByLink(reader, origin, first.link, chatId);
        // 3. The address without the fragment is a chat that is not there.
        const withoutLink = yield* meetsNothing(reader, `/en/chat/${chatId}`);
        const ofGoneChat = yield* meetsNothing(
          reader,
          `/en/chat/${gone.chatId}`
        );
        yield* Effect.sync(() => expect(withoutLink).toBe(ofGoneChat));
        // 4. Another learner reads the chat, with no control to write.
        yield* readsByLink(member, origin, first.link, chatId);

        // 5. The owner stops sharing: both pages lose the chat without a reload.
        yield* readsByLink(reader, origin, first.link, chatId);
        yield* Effect.promise(() => unshareChat(page, owner.changes));
        yield* losesTheChat(reader);
        yield* losesTheChat(member);
        yield* meetsNothing(reader, linkOn(origin, first.link));

        // 6. Sharing again makes a different link, and the first stays dead.
        const second = yield* copiesALink(page, owner.changes, chatId);
        yield* Effect.sync(() => expect(second.token).not.toBe(first.token));
        yield* meetsNothing(reader, linkOn(origin, first.link));
        yield* readsByLink(reader, origin, second.link, chatId);

        // No reader sent a mutation or an action to the server. The pages of
        // both were told where each turn stands and nothing of what it cost the
        // owner, nothing of the account that owns the chat, no live stream, no
        // part of a memory call and no report of the provider. The owner's own
        // page was told what the turn cost and which account owns the chat.
        yield* Effect.sync(() => {
          expect(readerChanges.sent).toBe(0);
          expect(memberChanges.sent).toBe(memberSent);
          learnsWhatTurnsCost(owner.changes);
          learnsWhoOwnsTheChat(owner.changes);
          for (const readerSide of [readerChanges, memberChanges]) {
            learnsOnlyWhereTurnsStand(readerSide);
            learnsNothingOfWhoOwnsTheChat(readerSide);
            learnsNoStreamAndNoMemory(readerSide);
          }
        });

        // 7. No request of the reader's page holds a token, to any host, and the
        // analytics it sent were answered and named no fragment.
        yield* Effect.promise(() =>
          expect
            .poll(
              () =>
                Arr.some(requests.pageviews(), ({ status }) => status === 200),
              { timeout: readinessTimeoutMilliseconds }
            )
            .toBe(true)
        );
        yield* Effect.sync(() => {
          expect(requests.carry(first.token)).toBe(false);
          expect(requests.carry(second.token)).toBe(false);
          expect(
            Arr.difference(requests.hosts(), [
              new URL(origin).host,
              new URL(owner.changes.origin).host,
            ])
          ).toEqual([]);
          expect(Arr.map(requests.pageviews(), ({ url }) => url)).toContain(
            `${origin}/en/chat/${chatId}`
          );
          expect(
            Arr.some(requests.pageviews(), ({ url }) =>
              String(url).includes("#")
            )
          ).toBe(false);
        });

        yield* profilesShowOnlyTheOwn(page, member, owner.learner.username);
      })
    )
  );
});

test.describe("Sharing a chat at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 300_000 });

  test("a shared chat opens by its link alone, and stops opening when sharing stops", async ({
    baseURL,
    browser,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      sharesAndStops(browser, page, origin)
    );
  });
});

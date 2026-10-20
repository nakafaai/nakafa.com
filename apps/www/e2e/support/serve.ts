import { expect, type Page } from "@playwright/test";
import {
  Array as Arr,
  Effect,
  MutableHashMap,
  MutableList,
  Option,
  Result,
} from "effect";
import { openChatPage } from "./chat";
import {
  CONVEX_SOCKET,
  decodeSent,
  decodeTransition,
  encodeTransition,
} from "./frames";
import {
  type Asked,
  type AskedQueries,
  answerTo,
  noticeQueries,
  type ServedMessage,
  type StoredMessage,
} from "./query";
import { BUBBLE_CONTENT, TRANSCRIPT_ROW } from "./selector";
import { readinessTimeoutMilliseconds } from "./timeout";

/** A frame in which the server moves the page to a new view of the database. */
type Transition = Option.Option.Value<ReturnType<typeof decodeTransition>>;

/**
 * Makes the page read `messages` as the transcript of the chat it shows. The
 * stored transcript of a chat comes from the model, which the local backend
 * has not got, so the frames the server sends for the messages query carry
 * these messages instead, and nothing in the page knows the difference: it asks
 * for pages, and the pages are cut from the list the way the server cuts them.
 * Call it before the page opens its connection, which is before the page loads.
 *
 * It returns the way to write an answer while the page watches: `begin` opens
 * a stream of the turn `turn`, and `push` gives the page more of its chunks.
 * The page asks for the stream the way it does for Nina's own, so each chunk
 * goes through the same code a model's would.
 */
const serveMessages = Effect.fn("NakafaE2E.serveMessages")(function* (
  page: Page,
  messages: readonly ServedMessage[]
) {
  /** The chunks of the answer being written, and the turn it answers. */
  const chunks = MutableList.make<unknown>();
  let order: number | null = null;
  /** Whether the turns that ended are held back, as `hold` asks. */
  let held = false;
  /** Each connection of the page: what it asked, how to reach it, and the view it last held. */
  const connections = MutableList.make<{
    readonly asked: AskedQueries;
    readonly send: (frame: string) => void;
    view: Option.Option<Transition>;
  }>();

  /** The change that gives a query the value it asks for. */
  const updateOf = (queryId: number, asked: typeof Asked.Type) => ({
    journal: null,
    logLines: [],
    queryId,
    type: "QueryUpdated",
    value: answerTo(asked, messages, {
      chunks: MutableList.toArray(chunks),
      order,
    }),
  });

  /** Gives every connection the new value of the queries a change moves. */
  const refresh = (reads: (asked: typeof Asked.Type) => boolean) => {
    for (const connection of MutableList.toArray(connections)) {
      if (Option.isNone(connection.view)) {
        continue;
      }
      const changes = Arr.filterMap(
        Arr.fromIterable(connection.asked),
        ([queryId, asked]) =>
          reads(asked)
            ? Result.succeed(updateOf(queryId, asked))
            : Result.failVoid
      );
      if (Arr.isReadonlyArrayNonEmpty(changes)) {
        // The page already stands at this view, so the frame starts and ends there.
        connection.send(
          encodeTransition({
            ...connection.view.value,
            modifications: changes,
            startVersion: connection.view.value.endVersion,
          })
        );
      }
    }
  };

  yield* Effect.promise(() =>
    page.routeWebSocket(CONVEX_SOCKET, (socket) => {
      const server = socket.connectToServer();
      const connection = {
        asked: MutableHashMap.empty<number, typeof Asked.Type>(),
        send: (frame: string) => socket.send(frame),
        view: Option.none<Transition>(),
      };
      MutableList.append(connections, connection);

      socket.onMessage((message) => {
        const sent = decodeSent(message.toString());

        if (Option.isSome(sent)) {
          noticeQueries(connection.asked, sent.value);
        }
        server.send(message);
      });

      server.onMessage((message) => {
        const transition = decodeTransition(message.toString());

        if (Option.isNone(transition)) {
          socket.send(message);
          return;
        }
        connection.view = transition;
        // The answers to our queries are ours, and everything else is the server's.
        // A turns answer that `hold` keeps back is left out, and `release` sends it.
        socket.send(
          encodeTransition({
            ...transition.value,
            modifications: Arr.filterMap(
              transition.value.modifications,
              (change) => {
                const query =
                  change.type === "QueryUpdated" ||
                  change.type === "QueryFailed"
                    ? MutableHashMap.get(connection.asked, change.queryId)
                    : Option.none();

                if (
                  Option.isSome(query) &&
                  held &&
                  query.value.kind === "turns"
                ) {
                  return Result.failVoid;
                }
                return Result.succeed(
                  Option.isNone(query)
                    ? change
                    : updateOf(change.queryId, query.value)
                );
              }
            ),
          })
        );
      });
    })
  );

  return {
    /** Opens the stream of the answer to the turn `turn`, with nothing written yet. */
    begin(turn: number) {
      order = turn;
      refresh((asked) => asked.kind === "list");
    },
    /** Gives the page the chunks of the answer, in order, as the model writes them. */
    push(more: readonly unknown[]) {
      for (const chunk of more) {
        MutableList.append(chunks, chunk);
      }
      refresh((asked) => asked.kind === "deltas");
    },
    /** Keeps the turns that ended back from the page, so it holds none of them until `release`. */
    hold() {
      held = true;
    },
    /** Gives the page the turns that `hold` kept back, and every turns answer after it. */
    release() {
      held = false;
      refresh((asked) => asked.kind === "turns");
    },
  };
});

/**
 * Signs a synthetic learner in, starts a chat that the local backend cannot
 * answer, and opens its page in `locale` with `messages` as its transcript. It
 * returns the way to write an answer while the page watches, once the first
 * row of the transcript shows.
 */
export const openServedChat = Effect.fn("NakafaE2E.openServedChat")(function* (
  page: Page,
  baseURL: string,
  messages: readonly ServedMessage[],
  locale = "en"
) {
  const { learner } = yield* openChatPage(page, baseURL);
  const chat = yield* learner.startChat("A question that the page replaces");
  const served = yield* serveMessages(page, messages);

  yield* Effect.promise(async () => {
    await page.goto(`/${locale}/chat/${chat.chatId}`);
    await expect(page.locator(TRANSCRIPT_ROW).first()).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
  });
  return served;
});

/** The row of the transcript that shows `message`, drawn or not. */
export const rowOf = (page: Page, message: StoredMessage) =>
  page.locator(`${TRANSCRIPT_ROW}[data-message-id="${message.key}"]`);

/**
 * The row of the transcript that shows `message`, scrolled to and drawn.
 *
 * A row that is out of sight is not drawn (`content-visibility` on the rows),
 * which empties its `innerText`. And while the pictures of other rows load,
 * the message scroller of `@shadcn/react` puts the view back on the question
 * it anchors, or, just after it scrolled itself, on the end of the chat. Only
 * a wheel, a touch or a scroll key frees it from an anchor, and a scroll made
 * by a test is none of those. So the row is scrolled to again until it has
 * drawn.
 */
export const drawnRow = async (page: Page, message: StoredMessage) => {
  const row = rowOf(page, message);

  await expect
    .poll(async () => {
      await row.scrollIntoViewIfNeeded();
      return row.evaluate(
        (element) =>
          element instanceof HTMLElement && element.innerText.length > 0
      );
    })
    .toBe(true);
  return row;
};

/** The box that holds the words of the row that shows `message`, once the row has drawn. */
export const bubbleOf = async (page: Page, message: StoredMessage) =>
  (await drawnRow(page, message)).locator(BUBBLE_CONTENT);

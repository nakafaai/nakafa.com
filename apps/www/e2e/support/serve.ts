import { expect, type Page } from "@playwright/test";
import {
  Array as Arr,
  Effect,
  MutableHashMap,
  MutableList,
  Option,
  Result,
} from "effect";
import { openChatPage } from "@/e2e/support/chat";
import {
  CONVEX_SOCKET,
  decodeSent,
  decodeTransition,
  encodeTransition,
} from "@/e2e/support/frames";
import {
  type Asked,
  type AskedQueries,
  noticeQueries,
  pageOf,
  type StoredMessage,
} from "@/e2e/support/query";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The stream that carries the answer being written. */
const STREAM_ID = "prose-stream";

/** The rows of a transcript: one for each message, and the alert of the chat's failed turn after them. */
export const ROW = '[data-slot="message-scroller-item"]';

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
  messages: readonly StoredMessage[]
) {
  /** The chunks of the answer being written, and the turn it answers. */
  const chunks = MutableList.make<unknown>();
  let order: number | null = null;
  /** Each connection of the page: what it asked, how to reach it, and the view it last held. */
  const connections = MutableList.make<{
    readonly asked: AskedQueries;
    readonly send: (frame: string) => void;
    view: Option.Option<Transition>;
  }>();

  /** The value one query is given, from the messages and the answer being written. */
  const answerTo = (asked: typeof Asked.Type) => {
    if (asked.kind === "page") {
      return pageOf(messages, asked.cursor, asked.numItems);
    }
    const base = { continueCursor: "", isDone: true, page: [] };
    if (asked.kind === "list") {
      return {
        ...base,
        streams: {
          kind: "list",
          messages:
            order === null
              ? []
              : [
                  {
                    format: "UIMessageChunk",
                    order,
                    status: "streaming",
                    stepOrder: 1,
                    streamId: STREAM_ID,
                  },
                ],
        },
      };
    }
    const all = MutableList.toArray(chunks);
    const parts = Arr.drop(all, asked.cursor);
    return {
      ...base,
      streams: {
        deltas: Arr.isReadonlyArrayNonEmpty(parts)
          ? [
              {
                end: all.length,
                parts,
                start: asked.cursor,
                streamId: STREAM_ID,
              },
            ]
          : [],
        kind: "deltas",
      },
    };
  };

  /** The change that gives a query the value it asks for. */
  const updateOf = (queryId: number, asked: typeof Asked.Type) => ({
    journal: null,
    logLines: [],
    queryId,
    type: "QueryUpdated",
    value: answerTo(asked),
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
        socket.send(
          encodeTransition({
            ...transition.value,
            modifications: Arr.map(transition.value.modifications, (change) => {
              const query =
                change.type === "QueryUpdated" || change.type === "QueryFailed"
                  ? MutableHashMap.get(connection.asked, change.queryId)
                  : Option.none();

              return Option.isNone(query)
                ? change
                : updateOf(change.queryId, query.value);
            }),
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
  messages: readonly StoredMessage[],
  locale = "en"
) {
  const { learner } = yield* openChatPage(page, baseURL);
  const chat = yield* learner.startChat("A question that the page replaces");
  const served = yield* serveMessages(page, messages);

  yield* Effect.promise(async () => {
    await page.goto(`/${locale}/chat/${chat.chatId}`);
    await expect(page.locator(ROW).first()).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
  });
  return served;
});

/**
 * The row of the transcript that shows `message`, scrolled to and drawn. A row
 * that is out of sight is not rendered at all, which empties its `innerText`,
 * and the transcript scrolls back to its end while the pictures of other rows
 * load, so the row is scrolled to again until it has drawn.
 */
export const drawnRow = async (page: Page, message: StoredMessage) => {
  const row = page.locator(`${ROW}[data-message-id="${message.key}"]`);

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

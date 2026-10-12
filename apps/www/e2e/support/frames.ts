import type { Page } from "@playwright/test";
import { Array as Arr, Effect, MutableHashSet, Option, Schema } from "effect";

/** The realtime connection of the page to the backend. */
const CONVEX_SOCKET = /\/api\/[^/]+\/sync/;
/** The Convex name of the query that reads a page of the list. */
const LIST = "nina/memory:list";

/** A memory as the list's answer holds it, whose fields a test may change. */
type Row = Readonly<Record<string, unknown>>;

/** The first sent frame that adds a query: which function it reads, under which id. */
const AddsQueries = Schema.Struct({
  modifications: Schema.Array(
    Schema.Struct({
      queryId: Schema.Finite,
      type: Schema.String,
      udfPath: Schema.optionalKey(Schema.String),
    })
  ),
  type: Schema.Literal("ModifyQuerySet"),
});

/** A frame from the server that tells the page what some queries now answer. */
const Transition = Schema.Struct({
  modifications: Schema.Array(
    Schema.Struct({
      queryId: Schema.Finite,
      type: Schema.String,
      value: Schema.optionalKey(Schema.Unknown),
    })
  ),
  type: Schema.Literal("Transition"),
});

/** The answer of the list: a page of memories. */
const ListAnswer = Schema.Struct({
  page: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
});

const decodeFrame = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Unknown)
);
const encodeFrame = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const isAdding = Schema.is(AddsQueries);
const isTransition = Schema.is(Transition);
const isListAnswer = Schema.is(ListAnswer);

/**
 * Changes what the list answers, for the connections the page opens from now
 * on, the way a backend that holds other memories would. `change` gets each
 * memory of a page, newest first, with its place on the page, and returns the
 * memory the page then shows. Everything else passes through as it is.
 */
export const rewriteList = Effect.fn("NakafaE2E.rewriteList")(function* (
  page: Page,
  change: (memory: Row, index: number) => Row
) {
  yield* Effect.promise(() =>
    page.routeWebSocket(CONVEX_SOCKET, (socket) => {
      const server = socket.connectToServer();
      // The queries of this connection that read the list.
      const lists = MutableHashSet.empty<number>();

      socket.onMessage((message) => {
        const frame = decodeFrame(message.toString());

        if (Option.isSome(frame) && isAdding(frame.value)) {
          for (const query of frame.value.modifications) {
            if (query.udfPath === LIST) {
              MutableHashSet.add(lists, query.queryId);
            }
          }
        }
        server.send(message);
      });
      server.onMessage((message) => {
        const frame = decodeFrame(message.toString());

        if (Option.isNone(frame) || !isTransition(frame.value)) {
          socket.send(message);
          return;
        }
        socket.send(
          encodeFrame({
            ...frame.value,
            modifications: Arr.map(frame.value.modifications, (update) =>
              MutableHashSet.has(lists, update.queryId) &&
              isListAnswer(update.value)
                ? {
                    ...update,
                    value: {
                      ...update.value,
                      page: Arr.map(update.value.page, change),
                    },
                  }
                : update
            ),
          })
        );
      });
    })
  );
});

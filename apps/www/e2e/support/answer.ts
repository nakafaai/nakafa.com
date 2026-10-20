import type { Page } from "@playwright/test";
import { Array as Arr, Effect, MutableHashSet, Option, Schema } from "effect";
import {
  CONVEX_SOCKET,
  decodeSent,
  decodeTransition,
  encodeTransition,
} from "./frames";
import { LIST_QUERY } from "./memory";

/** The answer of the list: a page of memories. */
const ListAnswer = Schema.Struct({
  page: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
});

/** A memory as the list's answer holds it, whose fields a test may change. */
type Row = (typeof ListAnswer.Type)["page"][number];

const isListAnswer = Schema.is(ListAnswer);

/**
 * Changes each memory of a page of the list with `change`, which gets the
 * memory and its place on the page, newest first, and returns the memory the
 * page then shows. The fields of the answer that are not memories go on as
 * they came, and so does any answer that is no page.
 */
const changeRows =
  (change: (memory: Row, index: number) => Row) => (value: unknown) =>
    isListAnswer(value)
      ? { ...value, page: Arr.map(value.page, change) }
      : value;

/**
 * Changes what the list answers, for the connections the page opens from now
 * on, the way a backend that holds other memories would. `change` gets each
 * memory of a page, newest first, with its place on the page, and returns the
 * memory the page then shows. Everything else passes through as it is: a
 * transition is read whole, so the fields that the rewrite does not read go on
 * as they came. A test that also follows the changes the page sends uses
 * `rewrite` of the tracker with `changeRows` instead, because the page's
 * connection goes through one route only.
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
        const frame = decodeSent(message.toString());

        if (Option.isSome(frame) && frame.value.type === "ModifyQuerySet") {
          for (const query of frame.value.modifications) {
            if (query.udfPath === LIST_QUERY) {
              MutableHashSet.add(lists, query.queryId);
            }
          }
        }
        server.send(message);
      });
      server.onMessage((message) => {
        const frame = decodeTransition(message.toString());

        if (Option.isNone(frame)) {
          socket.send(message);
          return;
        }
        socket.send(
          encodeTransition({
            ...frame.value,
            modifications: Arr.map(frame.value.modifications, (update) =>
              MutableHashSet.has(lists, update.queryId)
                ? { ...update, value: changeRows(change)(update.value) }
                : update
            ),
          })
        );
      });
    })
  );
});

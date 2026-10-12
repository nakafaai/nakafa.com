import type { Page } from "@playwright/test";
import { Array as Arr, Effect, MutableHashSet, Option, Schema } from "effect";
import {
  CONVEX_SOCKET,
  decodeFrame,
  decodeSent,
  encodeFrame,
  isTransition,
} from "@/e2e/support/frames";
import { LIST_QUERY } from "@/e2e/support/memory";

/** The answer of the list: a page of memories. */
const ListAnswer = Schema.Struct({
  page: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
});

/** A memory as the list's answer holds it, whose fields a test may change. */
type Row = (typeof ListAnswer.Type)["page"][number];

const isListAnswer = Schema.is(ListAnswer);

/**
 * Changes what the list answers, for the connections the page opens from now
 * on, the way a backend that holds other memories would. `change` gets each
 * memory of a page, newest first, with its place on the page, and returns the
 * memory the page then shows. Everything else passes through as it is: a frame
 * is read as plain JSON, so the fields of a transition that the rewrite does
 * not read go on as they came.
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

import type { EditorState } from "@tiptap/pm/state";
import { Effect } from "effect";
import { sendableSteps } from "prosemirror-collab";
import { reportClientException } from "@/lib/analytics/client";
import { statePort } from "@/lib/editor/port";
import { reportDropped } from "@/lib/editor/report";
import type { SyncSession } from "@/lib/editor/session";
import { tick } from "@/lib/editor/sync";

/**
 * The most rounds a closed editor runs. One round sends the steps the editor holds, and the
 * next round takes the server's answer, so three rounds cover a batch that the server takes.
 */
const CLOSE_ROUNDS = 3;

/**
 * Runs up to `rounds` rounds over the port. A round stops the flush when it fails, after the
 * failure is reported. A round reports the steps it lost, once.
 */
const sendLeft = Effect.fn("editor.sync.close.rounds")(function* (
  session: SyncSession,
  rounds: number,
  source: string
): Effect.fn.Return<void, never> {
  const state = yield* session.port.state;
  if (rounds === 0 || sendableSteps(state) === null) {
    return;
  }
  const finished = yield* tick(session).pipe(
    Effect.tap((dropped) => reportDropped(dropped, source)),
    Effect.as(true),
    Effect.catch((error) =>
      reportClientException(error, { source }).pipe(Effect.as(false))
    )
  );
  if (finished) {
    yield* sendLeft(session, rounds - 1, source);
  }
});

/**
 * Sends what a closed editor still holds. The loop runs over a plain state, the last one the
 * editor showed, so the steps typed before the editor closed reach the server. It stops at
 * once when no step is left to send, and after `CLOSE_ROUNDS` rounds.
 */
export const closeEditor = Effect.fn("editor.sync.close")(function* (
  session: SyncSession,
  last: Effect.Effect<EditorState>,
  source: string
) {
  // A round in flight finishes first, so the state read below is the one the loop left.
  yield* session.rounds.withPermits(1)(Effect.void);
  const port = yield* statePort(yield* last);
  yield* sendLeft({ ...session, port }, CLOSE_ROUNDS, source);
});

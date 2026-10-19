import { randomUuid } from "@repo/utilities/uuid";
import { Effect, Option, Ref, Schedule, Semaphore } from "effect";
import { pull } from "@/lib/editor/pull";
import { push } from "@/lib/editor/send";
import {
  type EditorPort,
  type Memory,
  SyncDropped,
  SyncFailed,
  type SyncSession,
  type SyncTransport,
} from "@/lib/editor/session";
import { readDocument, receiveOnto, settleSteps } from "@/lib/editor/settle";

/**
 * Opens the document for an editor. The editor gets a session ID of its own, the
 * snapshot becomes its starting state, and the steps after the snapshot follow. The
 * editor's state is replaced only while it still holds the state read before the
 * document opened: an edit that landed in between fails the start, so it is never lost.
 */
export const startSync = Effect.fn("editor.sync.start")(function* (
  port: EditorPort,
  transport: SyncTransport
) {
  const clientId = yield* randomUuid;
  const from = yield* port.state;
  const opened = yield* transport.open(clientId);
  const doc = yield* readDocument(port.schema, opened.snapshot.content);
  const settled = yield* settleSteps(port.schema, doc, opened.steps);
  const fresh = port.fresh({
    clientId,
    doc,
    version: opened.snapshot.version,
  });
  const replaced = yield* port.replace(
    from,
    receiveOnto(fresh, settled.received, [])
  );
  if (!replaced) {
    return yield* new SyncFailed({
      reason:
        "The editor changed while the document opened, so it did not open.",
    });
  }
  const memory = yield* Ref.make<typeof Memory.Type>({
    batch: Option.none(),
    clientId,
    dropped: 0,
  });
  const server = yield* Ref.make(settled.doc);
  const rounds = yield* Semaphore.make(1);
  const session: SyncSession = { memory, port, rounds, server, transport };
  return session;
});

/**
 * One round of sync: take the server's steps, then send the editor's own steps. The
 * server folds the steps into the snapshot, so an editor never writes one (ADR 0028).
 */
const round = Effect.fn("editor.sync.round")(function* (session: SyncSession) {
  yield* pull(session);
  yield* push(session);
});

/**
 * Takes the count of steps the editor lost while it opened again, and clears it, so
 * that the count is reported once. The count is `Option.none` when nothing was lost.
 */
const takeDropped = Effect.fn("editor.sync.takeDropped")(function* (
  session: SyncSession
) {
  const count = yield* Ref.modify(session.memory, (current) => [
    current.dropped,
    { ...current, dropped: 0 },
  ]);
  return count === 0
    ? Option.none<SyncDropped>()
    : Option.some(new SyncDropped({ count }));
});

/**
 * How a round that meets a fold waits before it runs again: a quarter second at first,
 * doubling, and never more than four seconds. The server folds a backlog in a scheduled
 * function, which runs after the submit that made the backlog (ADR 0028), so these waits
 * give that function time to run.
 */
const FOLD_WAIT = Schedule.min([
  Schedule.exponential("250 millis"),
  Schedule.spaced("4 seconds"),
]);

/** The most times a round that meets a fold runs again, after its first run. */
const FOLD_RETRIES = 6;

/**
 * How often a round that used up its short waits runs again: every four seconds, under the
 * same batch id, for as long as the caller keeps `tickThroughFold` running. The fold is still
 * a scheduled function on the server, so the batch waits unsent meanwhile, and no round fails
 * for it (ADR 0028).
 */
export const FOLD_RETRY = Schedule.spaced("4 seconds");

/**
 * Runs one round of sync for an editor. The caller runs the next round when the server's
 * steps arrive, as the subscription to the document does. The one repeat is for a batch
 * that waits for a fold: the round runs again on `FOLD_WAIT`, up to `FOLD_RETRIES` times,
 * under the same batch id. A fold still due after them fails the round with `SyncFolding`,
 * and `tickThroughFold` runs the round again. Rounds of one editor run one at a time: a
 * round that starts while another is in flight waits for it, so the server's reply is
 * applied once. The result says how many steps the editor lost, once, when it had to open
 * again. A round that fails keeps that count for the next round that completes.
 */
export const tick = Effect.fn("editor.sync.tick")(function* (
  session: SyncSession
) {
  yield* session.rounds.withPermits(1)(
    round(session).pipe(
      Effect.retry({
        schedule: FOLD_WAIT,
        times: FOLD_RETRIES,
        while: (error) => error._tag === "SyncFolding",
      })
    )
  );
  return yield* takeDropped(session);
});

/**
 * Runs `tick` until the server takes the batch, and runs it again on `schedule` while the
 * fold is due, so a fold never fails the sync (ADR 0028). Each round runs uninterruptibly,
 * so a caller that interrupts the loop stops it between two rounds and never inside one.
 * `afterRound` runs at the end of each round that completes, inside the same region. A
 * round that still meets the fold when `schedule` ends fails with `SyncFolding`, which the
 * caller reports or ignores.
 */
export const tickThroughFold = Effect.fn("editor.sync.tickThroughFold")(
  function* (
    session: SyncSession,
    schedule: Schedule.Schedule<unknown>,
    afterRound: (dropped: Option.Option<SyncDropped>) => Effect.Effect<void>
  ) {
    return yield* tick(session).pipe(
      Effect.tap(afterRound),
      Effect.uninterruptible,
      Effect.retry({
        schedule,
        while: (error) => error._tag === "SyncFolding",
      })
    );
  }
);

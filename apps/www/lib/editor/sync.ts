import { randomUuid } from "@repo/utilities/uuid";
import { Effect, Option, Ref, Semaphore } from "effect";
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
 * Runs one round of sync for an editor. It never loops. After a refused batch, the
 * caller runs the next round when the server's steps arrive, as the subscription
 * to the document does. Rounds of one editor run one at a time: a round that starts
 * while another is in flight waits for it, so the server's reply is applied once.
 * The result says how many steps the editor lost, once, when it had to open again.
 * A round that fails keeps that count for the next round that completes.
 */
export const tick = Effect.fn("editor.sync.tick")(function* (
  session: SyncSession
) {
  yield* session.rounds.withPermits(1)(round(session));
  return yield* takeDropped(session);
});

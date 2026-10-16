import { randomUuid } from "@repo/utilities/uuid";
import { Effect, Option, Ref, Semaphore } from "effect";
import { applySteps, pull, readDocument } from "@/lib/editor/receive";
import { push } from "@/lib/editor/send";
import {
  type EditorPort,
  type Memory,
  nowTime,
  type SyncSession,
  type SyncTransport,
} from "@/lib/editor/session";
import { snapshotIfDue } from "@/lib/editor/snapshot";

/**
 * Opens the document for an editor. The editor gets a session ID of its own, the
 * snapshot becomes its starting state, and the steps after the snapshot follow.
 */
export const startSync = Effect.fn("editor.sync.start")(function* (
  port: EditorPort,
  transport: SyncTransport
) {
  const clientId = yield* randomUuid;
  const opened = yield* transport.open(clientId);
  const doc = yield* readDocument(port.schema, opened.snapshot.content);
  yield* port.replace({ clientId, doc, version: opened.snapshot.version });
  const now = yield* nowTime;
  const memory = yield* Ref.make<typeof Memory.Type>({
    batch: Option.none(),
    clientId,
    head: opened.snapshot.version,
    lastChangeAt: now,
    snapshotAt: Option.none(),
    snapshotVersion: opened.snapshot.version,
  });
  const server = yield* Ref.make(doc);
  const rounds = yield* Semaphore.make(1);
  const session: SyncSession = { memory, port, rounds, server, transport };
  yield* applySteps(session, opened.steps, opened.head, true);
  return session;
});

/**
 * One round of sync: take the server's steps, send the editor's own steps, and save a
 * snapshot when the rule allows one. The result is the count of steps the editor lost
 * while it opened the document again, when it had to.
 */
const round = Effect.fn("editor.sync.round")(function* (session: SyncSession) {
  const dropped = yield* pull(session);
  yield* push(session);
  yield* snapshotIfDue(session);
  return dropped;
});

/**
 * Runs one round of sync for an editor. It never loops. After a refused batch, the
 * caller runs the next round when the server's steps arrive, as the subscription
 * to the document does. Rounds of one editor run one at a time: a round that starts
 * while another is in flight waits for it, so the server's reply is applied once.
 * The result says how many steps the editor lost, once, when it had to open again.
 */
export const tick = Effect.fn("editor.sync.tick")(function* (
  session: SyncSession
) {
  return yield* session.rounds.withPermits(1)(round(session));
});

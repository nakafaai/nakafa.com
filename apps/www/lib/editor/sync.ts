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
 * Opens the document for an editor. The editor gets a client ID of its own, the
 * snapshot becomes its starting state, and the steps after the snapshot follow.
 */
export const startSync = Effect.fn("editor.sync.start")(function* (
  port: EditorPort,
  transport: SyncTransport
) {
  const clientId = yield* randomUuid;
  const opened = yield* transport.open;
  const doc = yield* readDocument(port.schema, opened.snapshot.content);
  yield* port.replace({ clientId, doc, version: opened.snapshot.version });
  const now = yield* nowTime;
  const memory = yield* Ref.make<typeof Memory.Type>({
    blockedAt: Option.none(),
    clientId,
    head: opened.snapshot.version,
    lastChangeAt: now,
    snapshotAt: Option.none(),
    snapshotVersion: opened.snapshot.version,
  });
  const rounds = yield* Semaphore.make(1);
  const session: SyncSession = { memory, port, rounds, transport };
  yield* applySteps(session, opened.steps, opened.head);
  return session;
});

/** One round of sync: take the server's steps, send the editor's own steps, and save a snapshot when the rule allows one. */
const round = Effect.fn("editor.sync.round")(function* (session: SyncSession) {
  yield* pull(session);
  yield* push(session);
  yield* snapshotIfDue(session);
});

/**
 * Runs one round of sync for an editor. It never loops. After a refused batch, the
 * caller runs the next round when the server's steps arrive, as the subscription
 * to the document does. Rounds of one editor run one at a time: a round that starts
 * while another is in flight waits for it, so the server's reply is applied once.
 */
export const tick = Effect.fn("editor.sync.tick")(function* (
  session: SyncSession
) {
  yield* session.rounds.withPermits(1)(round(session));
});

import { describe, expect, it } from "@effect/vitest";
import { encodeBatch } from "@repo/backend/confect/editor/batch";
import {
  MAX_BATCH_BYTES,
  MAX_BATCH_STEPS,
} from "@repo/backend/confect/editor/size";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Option, Ref } from "effect";
import { getVersion, sendableSteps } from "prosemirror-collab";
import {
  SyncFailed,
  type SyncSession,
  type SyncTransport,
} from "@/lib/editor/session";
import { startSync, tick } from "@/lib/editor/sync";
import {
  makePort,
  makeServer,
  nestedQuote,
  openEditor,
  settle,
  silentEditor,
  THREE_LETTERS,
  textOf,
  typeText,
} from "@/test/sync";

/** The text of two letters typed by two editors, in either order. */
const TWO_LETTERS = /^[ab]{2}$/;

describe("editor/sync convergence", () => {
  it.effect("converges two editors on one document and loses no step", () =>
    Effect.gen(function* () {
      const server = yield* makeServer();
      const first = yield* openEditor(server.transport);
      const second = yield* openEditor(server.transport);
      yield* typeText(first.state, "a");
      yield* typeText(second.state, "b");
      yield* settle([first.session, second.session], 2);
      const firstState = yield* Ref.get(first.state);
      const secondState = yield* Ref.get(second.state);
      expect(textOf(firstState.doc)).toBe(textOf(secondState.doc));
      expect(textOf(firstState.doc)).toMatch(TWO_LETTERS);
      expect(yield* server.counts).toMatchObject({ head: 2, submits: 2 });
      expect(sendableSteps(firstState)).toBeNull();
      expect(sendableSteps(secondState)).toBeNull();
    })
  );

  it.effect(
    "converges three editors that edit at once, with no step lost",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const first = yield* openEditor(server.transport);
        const second = yield* openEditor(server.transport);
        const third = yield* openEditor(server.transport);
        yield* typeText(first.state, "a");
        yield* typeText(second.state, "b");
        yield* typeText(third.state, "c");
        yield* settle([first.session, second.session, third.session], 3);
        const firstState = yield* Ref.get(first.state);
        const secondState = yield* Ref.get(second.state);
        const thirdState = yield* Ref.get(third.state);
        expect(secondState.doc.toJSON()).toEqual(firstState.doc.toJSON());
        expect(thirdState.doc.toJSON()).toEqual(firstState.doc.toJSON());
        expect(textOf(firstState.doc)).toMatch(THREE_LETTERS);
        expect(yield* server.counts).toMatchObject({ head: 3, submits: 3 });
      })
  );
});

describe("editor/sync refusals and waiting", () => {
  it.effect(
    "waits for the server's steps after a refused batch, and does not resend on the same version",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const first = yield* openEditor(server.transport);
        const second = yield* openEditor(server.transport);
        yield* typeText(first.state, "a");
        yield* typeText(second.state, "b");
        yield* tick(first.session);
        // The steps of the first editor have not reached the second one yet, so the
        // second one names version 0 while the server is at 1.
        const silent = silentEditor(server, second.session);
        yield* tick(silent);
        yield* tick(silent);
        // One accepted batch from the first editor, and one refused batch from the second:
        // the second batch is not sent again while the server's steps have not arrived.
        expect(yield* server.counts).toMatchObject({
          head: 1,
          submitAttempts: 2,
          submits: 1,
        });
        yield* tick(second.session);
        expect(yield* server.counts).toMatchObject({
          head: 2,
          submitAttempts: 3,
          submits: 2,
        });
      })
  );

  it.effect("applies a reply once when two rounds of one editor overlap", () =>
    Effect.gen(function* () {
      const server = yield* makeServer();
      const writer = yield* openEditor(server.transport);
      const reader = yield* openEditor(server.transport);
      yield* typeText(writer.state, "a");
      yield* tick(writer.session);
      // Each read of the server yields, so the second round starts before the first ends.
      const slow: SyncSession = {
        ...reader.session,
        transport: {
          ...server.transport,
          since: (clientId, version) =>
            Effect.yieldNow.pipe(
              Effect.andThen(server.transport.since(clientId, version))
            ),
        },
      };
      yield* Effect.forEach([slow, slow], (session) => tick(session), {
        concurrency: 2,
      });
      const readerState = yield* Ref.get(reader.state);
      expect(textOf(readerState.doc)).toBe("a");
      expect(getVersion(readerState)).toBe(1);
    })
  );

  it.effect(
    "splits a long run of steps into calls of at most one call's worth, the rest on the next round",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const editor = yield* openEditor(server.transport);
        yield* Effect.forEach(
          Arr.makeBy(MAX_BATCH_STEPS + 1, (index) => index),
          () => typeText(editor.state, "x")
        );
        yield* tick(editor.session);
        expect(yield* server.counts).toMatchObject({
          head: MAX_BATCH_STEPS,
          submits: 1,
        });
        yield* tick(editor.session);
        expect(yield* server.counts).toMatchObject({
          head: MAX_BATCH_STEPS + 1,
          submits: 2,
        });
      })
  );

  it.effect(
    "halves a call that is over the byte bound until its steps fit",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const editor = yield* openEditor(server.transport);
        const large = "x".repeat(100_000);
        yield* typeText(editor.state, large);
        yield* typeText(editor.state, large);
        yield* tick(editor.session);
        expect(yield* server.counts).toMatchObject({ head: 1, submits: 1 });
        yield* tick(editor.session);
        expect(yield* server.counts).toMatchObject({ head: 2, submits: 2 });
      })
  );
});

describe("editor/sync steps no call can carry", () => {
  it.effect(
    "drops a queued step that is larger than one call may send, counts it, and sends the next batch",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const editor = yield* openEditor(server.transport);
        // A run of letters of one call's bound: its step is over the bound once it is encoded.
        yield* typeText(editor.state, "x".repeat(MAX_BATCH_BYTES));
        const dropped = yield* tick(editor.session);
        expect(Option.getOrNull(dropped)).toMatchObject({
          _tag: "SyncDropped",
          count: 1,
        });
        expect(yield* server.counts).toMatchObject({ head: 0, submits: 0 });
        yield* typeText(editor.state, "b");
        yield* tick(editor.session);
        expect(yield* server.counts).toMatchObject({ head: 1, submits: 1 });
        // The next round takes the server's steps, which confirm the batch.
        yield* tick(editor.session);
        const state = yield* Ref.get(editor.state);
        expect(textOf(state.doc)).toBe("b");
        expect(sendableSteps(state)).toBeNull();
      })
  );
});

describe("editor/sync failures", () => {
  it.effect(
    "refuses to start from a snapshot the editor's schema cannot read",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer(encodeJsonText({ type: "unknown" }));
        const failure = yield* openEditor(server.transport).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "SyncFailed" });
      })
  );

  it.effect(
    "skips a stored step the editor's schema cannot read, as the server does, and keeps the document",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const editor = yield* openEditor(server.transport);
        const text = yield* encodeBatch({
          baseVersion: 0,
          batch: "rina-heading",
          clientId: "rina",
          steps: [
            {
              from: 1,
              slice: { content: [{ type: "heading" }] },
              stepType: "replace",
              to: 1,
            },
          ],
        }).pipe(Effect.orDie);
        yield* server.transport.submit(text).pipe(Effect.orDie);
        yield* tick(editor.session).pipe(Effect.orDie);
        const state = yield* Ref.get(editor.state);
        expect(textOf(state.doc)).toBe("");
        expect(getVersion(state)).toBe(1);
      })
  );

  it.effect(
    "sends the batch again on the next round after a call that failed",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const editor = yield* openEditor(server.transport);
        yield* typeText(editor.state, "a");
        const offline: SyncSession = {
          ...editor.session,
          transport: {
            ...server.transport,
            submit: () => Effect.fail(new SyncFailed({ reason: "offline" })),
          },
        };
        const failure = yield* tick(offline).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "SyncFailed",
          reason: "offline",
        });
        expect(yield* server.counts).toMatchObject({ head: 0, submits: 0 });
        yield* tick(editor.session);
        expect(yield* server.counts).toMatchObject({ head: 1, submits: 1 });
      })
  );

  it.effect(
    "takes a batch once when the answer to its call was lost, because the call sends the same batch again",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const editor = yield* openEditor(server.transport);
        yield* typeText(editor.state, "a");
        // The server takes the batch, and the answer never reaches the editor.
        const lost: SyncSession = {
          ...editor.session,
          transport: {
            ...server.transport,
            submit: (text) =>
              server.transport
                .submit(text)
                .pipe(
                  Effect.andThen(
                    Effect.fail(new SyncFailed({ reason: "lost" }))
                  )
                ),
          },
        };
        const failure = yield* tick(lost).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "SyncFailed", reason: "lost" });
        expect(yield* server.counts).toMatchObject({ head: 1, submits: 1 });
        // The next round has no steps from the server yet, so it sends the batch again.
        yield* tick(silentEditor(server, editor.session));
        expect(yield* server.counts).toMatchObject({
          head: 1,
          submitAttempts: 2,
          submits: 1,
        });
        yield* tick(editor.session);
        expect(yield* server.counts).toMatchObject({ head: 1, submits: 1 });
        expect(textOf((yield* Ref.get(editor.state)).doc)).toBe("a");
      })
  );

  it.effect(
    "fails with a typed error on every round for a step the server refuses, and sends nothing",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const editor = yield* openEditor(server.transport);
        yield* Ref.update(editor.state, (current) =>
          current.apply(current.tr.insert(0, nestedQuote(17)))
        );
        const first = yield* tick(editor.session).pipe(Effect.flip);
        const second = yield* tick(editor.session).pipe(Effect.flip);
        expect([first, second]).toMatchObject([
          { _tag: "SyncFailed" },
          { _tag: "SyncFailed" },
        ]);
        expect(yield* server.counts).toMatchObject({ head: 0, submits: 0 });
      })
  );

  it.effect(
    "refuses to start when an edit lands while the document opens, so the edit is not lost",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const { port, state } = yield* makePort();
        const racing: SyncTransport = {
          ...server.transport,
          open: (clientId) =>
            typeText(state, "a").pipe(
              Effect.andThen(server.transport.open(clientId))
            ),
        };
        const failure = yield* startSync(port, racing).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "SyncFailed" });
        expect(textOf((yield* Ref.get(state)).doc)).toBe("a");
      })
  );
});

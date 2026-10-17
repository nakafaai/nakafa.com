import { describe, expect, it } from "@effect/vitest";
import { Effect, Option, Ref } from "effect";
import { getVersion, sendableSteps } from "prosemirror-collab";
import type { SyncSession } from "@/lib/editor/session";
import { startSync, tick } from "@/lib/editor/sync";
import {
  makePort,
  makeServer,
  openEditor,
  silentEditor,
  THREE_LETTERS,
  textOf,
  typeText,
} from "@/test/sync";

describe("editor/sync reopening from a snapshot", () => {
  it.effect(
    "opens the document again from its snapshot after the log pruned the steps an editor needs",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const writer = yield* openEditor(server.transport);
        const reader = yield* openEditor(server.transport);
        yield* typeText(writer.state, "a");
        yield* tick(writer.session);
        yield* tick(writer.session);
        yield* server.fold;
        expect(yield* server.counts).toMatchObject({
          head: 1,
          snapshotVersion: 1,
        });
        yield* typeText(writer.state, "b");
        yield* tick(writer.session);
        yield* tick(writer.session);
        yield* server.prune(1);
        yield* tick(reader.session);
        const readerState = yield* Ref.get(reader.state);
        const writerState = yield* Ref.get(writer.state);
        expect(getVersion(readerState)).toBe(2);
        expect(textOf(readerState.doc)).toBe(textOf(writerState.doc));
      })
  );

  it.effect(
    "replays the steps an editor holds onto the snapshot when it opens again, and sends them",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const writer = yield* openEditor(server.transport);
        const stale = yield* openEditor(server.transport);
        yield* typeText(writer.state, "a");
        yield* tick(writer.session);
        yield* tick(writer.session);
        yield* server.fold;
        yield* typeText(stale.state, "unsent");
        // The stale editor sends its batch before it sees the server's steps, so the server
        // refuses it, and it waits. The log then loses the steps it needs.
        yield* tick(silentEditor(server, stale.session));
        yield* server.prune(1);
        const dropped = yield* tick(stale.session);
        expect(Option.isNone(dropped)).toBe(true);
        expect(textOf((yield* Ref.get(stale.state)).doc)).toBe("unsenta");
        expect(yield* server.counts).toMatchObject({ head: 2, submits: 2 });
        yield* tick(writer.session);
        expect(textOf((yield* Ref.get(writer.state)).doc)).toBe("unsenta");
      })
  );

  it.effect(
    "keeps the rest of an editor's steps when its batch landed, and does not send the landed steps again",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const writer = yield* openEditor(server.transport);
        const other = yield* openEditor(server.transport);
        yield* typeText(writer.state, "a");
        yield* tick(writer.session);
        yield* typeText(writer.state, "b");
        yield* tick(other.session);
        yield* server.fold;
        expect(yield* server.counts).toMatchObject({
          head: 1,
          snapshotVersion: 1,
        });
        yield* server.prune(1);
        const dropped = yield* tick(writer.session);
        expect(Option.isNone(dropped)).toBe(true);
        expect(textOf((yield* Ref.get(writer.state)).doc)).toBe("ba");
        // Two batches in all: the one that landed before the reopen, and the step typed after it.
        expect(yield* server.counts).toMatchObject({ head: 2, submits: 2 });
      })
  );

  it.effect(
    "reports the steps an editor lost when it opened again, once, and a step that throws counts as lost too",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const writer = yield* openEditor(server.transport);
        yield* typeText(writer.state, "wv");
        yield* tick(writer.session);
        const stale = yield* openEditor(server.transport);
        // "x" lands inside the text the writer deletes, and "y" past the end of the empty
        // document the server reopens from, so one step fails and one throws.
        yield* Ref.update(stale.state, (current) =>
          current.apply(current.tr.insertText("x", 2))
        );
        yield* Ref.update(stale.state, (current) =>
          current.apply(current.tr.insertText("y", 4))
        );
        // The writer deletes both letters, and the server takes the deletion.
        yield* Ref.update(writer.state, (current) =>
          current.apply(current.tr.delete(1, 3))
        );
        yield* tick(writer.session);
        yield* tick(writer.session);
        yield* server.fold;
        yield* server.prune(2);
        const reported = yield* tick(stale.session);
        expect(reported).toEqual(
          Option.some(
            expect.objectContaining({ _tag: "SyncDropped", count: 2 })
          )
        );
        expect(textOf((yield* Ref.get(stale.state)).doc)).toBe("");
        expect(yield* tick(stale.session).pipe(Effect.map(Option.isNone))).toBe(
          true
        );
      })
  );

  it.effect(
    "builds a reopened state again when an edit lands before it replaces the state, and keeps the edit",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const writer = yield* openEditor(server.transport);
        const { port, state } = yield* makePort();
        const reader = yield* startSync(port, server.transport);
        yield* typeText(writer.state, "a");
        yield* tick(writer.session);
        yield* tick(writer.session);
        yield* server.fold;
        yield* typeText(writer.state, "b");
        yield* tick(writer.session);
        yield* tick(writer.session);
        yield* server.prune(1);
        const raced = yield* Ref.make(false);
        const racing: SyncSession = {
          ...reader,
          port: {
            ...port,
            replace: (from, next) =>
              Effect.gen(function* () {
                if (!(yield* Ref.getAndSet(raced, true))) {
                  yield* typeText(state, "c");
                }
                return yield* port.replace(from, next);
              }),
          },
        };
        yield* tick(racing);
        const readerState = yield* Ref.get(state);
        expect(textOf(readerState.doc)).toMatch(THREE_LETTERS);
        expect(getVersion(readerState)).toBe(2);
        expect(sendableSteps(readerState)).not.toBeNull();
      })
  );
});

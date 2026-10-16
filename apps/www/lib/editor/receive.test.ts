import { describe, expect, it } from "@effect/vitest";
import { encodeBatch } from "@repo/backend/confect/editor/batch";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Option, Ref } from "effect";
import { TestClock } from "effect/testing";
import { getVersion } from "prosemirror-collab";
import type { SyncSession } from "@/lib/editor/session";
import { tick } from "@/lib/editor/sync";
import {
  EMPTY_DOCUMENT,
  IDLE,
  makeServer,
  openEditor,
  settle,
  silentEditor,
  textOf,
  typeText,
} from "@/test/sync";

/** The text of three letters typed by three editors, in any order. */
const THREE_LETTERS = /^[abc]{3}$/;

describe("editor/sync stored steps that do not apply", () => {
  it.effect(
    "converges three editors on one document when the log holds a step that does not apply, and every editor skips it",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        // The server stores this step without applying it: it moves past the end of the document.
        const bad = yield* encodeBatch({
          baseVersion: 0,
          batch: "rina-bad",
          clientId: "rina",
          steps: [
            {
              from: 99,
              slice: { content: [{ text: "x", type: "text" }] },
              stepType: "replace",
              to: 99,
            },
          ],
        }).pipe(Effect.orDie);
        yield* server.transport.submit(bad).pipe(Effect.orDie);
        const first = yield* openEditor(server.transport);
        const second = yield* openEditor(server.transport);
        const third = yield* openEditor(server.transport);
        yield* typeText(first.state, "a");
        yield* typeText(second.state, "b");
        yield* typeText(third.state, "c");
        yield* settle([first.session, second.session, third.session], 4);
        const firstState = yield* Ref.get(first.state);
        const secondState = yield* Ref.get(second.state);
        const thirdState = yield* Ref.get(third.state);
        expect(secondState.doc.toJSON()).toEqual(firstState.doc.toJSON());
        expect(thirdState.doc.toJSON()).toEqual(firstState.doc.toJSON());
        expect(textOf(firstState.doc)).toMatch(THREE_LETTERS);
        // The skipped step still counts in the version, so the editors stand at the head.
        expect(getVersion(firstState)).toBe(4);
        expect(getVersion(thirdState)).toBe(4);
        // A snapshot saved after the skip holds the document the editors share.
        yield* TestClock.adjust(IDLE);
        yield* tick(first.session);
        const snapshot = yield* server.snapshot;
        expect(snapshot).toEqual({
          content: encodeJsonText(firstState.doc.toJSON()),
          version: 4,
        });
      })
  );

  it.effect(
    "refuses a reply that skips a version, and applies none of its steps",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const writer = yield* openEditor(server.transport);
        const reader = yield* openEditor(server.transport);
        yield* typeText(writer.state, "a");
        yield* tick(writer.session);
        yield* typeText(writer.state, "b");
        yield* tick(writer.session);
        // This reply drops version 1, so it holds only version 2, which does not follow
        // the reader's version 0.
        const skipping: SyncSession = {
          ...reader.session,
          transport: {
            ...server.transport,
            since: (clientId, version) =>
              server.transport.since(clientId, version).pipe(
                Effect.map((reply) =>
                  reply._tag === "steps"
                    ? {
                        ...reply,
                        steps: Arr.filter(
                          reply.steps,
                          (step) => step.version !== 1
                        ),
                      }
                    : reply
                )
              ),
          },
        };
        const failure = yield* tick(skipping).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "SyncFailed" });
        const readerState = yield* Ref.get(reader.state);
        expect(textOf(readerState.doc)).toBe("");
        expect(getVersion(readerState)).toBe(0);
      })
  );
});

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
        yield* TestClock.adjust(IDLE);
        yield* tick(writer.session);
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
        yield* TestClock.adjust(IDLE);
        yield* tick(writer.session);
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
        yield* TestClock.adjust(IDLE);
        yield* tick(other.session);
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
        yield* server.transport.save({ content: EMPTY_DOCUMENT, version: 2 });
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
});

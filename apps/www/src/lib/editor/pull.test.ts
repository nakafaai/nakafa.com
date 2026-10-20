import { describe, expect, it } from "@effect/vitest";
import { Effect, Ref } from "effect";
import { getVersion } from "prosemirror-collab";
import type { SyncSession } from "@/lib/editor/session";
import { startSync, tick } from "@/lib/editor/sync";
import {
  makePort,
  makeServer,
  openEditor,
  textOf,
  typeText,
} from "@/test/sync";

describe("editor/sync edits that land while a change is applied", () => {
  it.effect(
    "builds a received change again when an edit lands before it applies, and keeps both edits",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const writer = yield* openEditor(server.transport);
        const { port, state } = yield* makePort();
        const reader = yield* startSync(port, server.transport);
        const raced = yield* Ref.make(false);
        const racing: SyncSession = {
          ...reader,
          port: {
            ...port,
            dispatch: (from, transaction) =>
              Effect.gen(function* () {
                if (!(yield* Ref.getAndSet(raced, true))) {
                  yield* typeText(state, "b");
                }
                return yield* port.dispatch(from, transaction);
              }),
          },
        };
        yield* typeText(writer.state, "a");
        yield* tick(writer.session);
        yield* tick(racing);
        const readerState = yield* Ref.get(state);
        expect(["ab", "ba"]).toContain(textOf(readerState.doc));
        expect(getVersion(readerState)).toBe(1);
      })
  );
});

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Effect, Schema } from "effect";
import { KeyValueStore } from "effect/persistence";
import {
  forgetKeptChat,
  keptChatStorage,
  readKeptChat,
  writeKeptChat,
} from "@/components/ai/store/kept";

const NAME = "nakafa-ai";
const chatId = Schema.decodeUnknownSync(Id("chats"))("chat-1");
const KEPT = { state: { activeChatId: chatId }, version: 1 };

const inMemory = <A, E>(
  effect: Effect.Effect<A, E, KeyValueStore.KeyValueStore>
) => Effect.provide(effect, KeyValueStore.layerMemory);

describe("writeKeptChat", () => {
  it.effect(
    "keeps the open chat, and writes nothing again for the same chat",
    () =>
      inMemory(
        Effect.gen(function* () {
          yield* writeKeptChat(NAME, KEPT);
          const store = yield* KeyValueStore.KeyValueStore;
          const first = yield* store.get(NAME);
          yield* writeKeptChat(NAME, KEPT);

          expect(yield* readKeptChat(NAME)).toEqual(KEPT);
          expect(yield* store.get(NAME)).toBe(first);
        })
      )
  );

  it.effect(
    "keeps nothing while no chat is open, and forgets a chat once none is open",
    () =>
      inMemory(
        Effect.gen(function* () {
          const store = yield* KeyValueStore.KeyValueStore;
          yield* writeKeptChat(NAME, {
            state: { activeChatId: null },
            version: 1,
          });
          expect(yield* store.get(NAME)).toBeUndefined();

          yield* writeKeptChat(NAME, KEPT);
          yield* writeKeptChat(NAME, {
            state: { activeChatId: null },
            version: 1,
          });
          expect(yield* store.get(NAME)).toBeUndefined();
        })
      )
  );

  it.effect("keeps a chat without a version as zustand gives it", () =>
    inMemory(
      Effect.gen(function* () {
        yield* writeKeptChat(NAME, { state: { activeChatId: chatId } });
        expect(yield* readKeptChat(NAME)).toEqual({
          state: { activeChatId: chatId },
        });
      })
    )
  );
});

describe("readKeptChat", () => {
  it.effect(
    "reads nothing kept, and storage that no longer decodes, as no chat",
    () =>
      inMemory(
        Effect.gen(function* () {
          expect(yield* readKeptChat(NAME)).toBeNull();
          const store = yield* KeyValueStore.KeyValueStore;
          yield* store.set(NAME, "not json");
          expect(yield* readKeptChat(NAME)).toBeNull();

          yield* forgetKeptChat(NAME);
          expect(yield* store.get(NAME)).toBeUndefined();
        })
      )
  );
});

describe("keptChatStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps, reads and forgets the chat in the browser's local storage", () => {
    keptChatStorage.setItem(NAME, KEPT);
    expect(keptChatStorage.getItem(NAME)).toEqual(KEPT);

    keptChatStorage.removeItem(NAME);
    expect(localStorage.getItem(NAME)).toBeNull();
  });

  it("keeps nothing and reads nothing from a browser that refuses its storage", () => {
    const refused = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("refused");
      });
    const removing = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new Error("refused");
      });

    expect(() => keptChatStorage.setItem(NAME, KEPT)).not.toThrow();
    expect(keptChatStorage.getItem(NAME)).toBeNull();
    expect(() => keptChatStorage.removeItem(NAME)).not.toThrow();

    refused.mockRestore();
    removing.mockRestore();
  });
});

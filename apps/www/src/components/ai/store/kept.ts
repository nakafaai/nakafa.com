import { Id } from "@repo/backend/confect/_generated/id";
import { Effect, Option, Schema } from "effect";
import { KeyValueStore } from "effect/persistence";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { keptStorage } from "@/components/player/storage";

/** What the browser keeps of Nina's store: the chat her sheet has open, with the version of that shape. */
const KeptChat = Schema.Struct({
  state: Schema.Struct({ activeChatId: Schema.NullOr(Id("chats")) }),
  version: Schema.optionalKey(Schema.Number),
});

const KeptChatJson = Schema.fromJsonString(KeptChat);

/** The part of Nina's store the browser keeps. */
type Kept = (typeof KeptChat.Type)["state"];

/** The kept chat stored under `name`. Storage that no longer decodes reads as nothing kept. */
export const readKeptChat = Effect.fn("ai.kept.read")(function* (name: string) {
  const store = yield* KeyValueStore.KeyValueStore;
  const stored = yield* store.get(name);
  return Option.getOrNull(
    Option.flatMap(
      Option.fromNullishOr(stored),
      Schema.decodeOption(KeptChatJson)
    )
  );
});

/**
 * Keeps the chat Nina's sheet has open under `name`, and writes only when that changes it: no chat open keeps nothing,
 * and the same chat writes nothing again. The store sets its state on every page load, and a page that stores state
 * with no gesture of the reader is what Firefox counts as a bounce tracker's.
 */
export const writeKeptChat = Effect.fn("ai.kept.write")(function* (
  name: string,
  value: StorageValue<Kept>
) {
  const store = yield* KeyValueStore.KeyValueStore;
  const stored = Option.fromNullishOr(yield* store.get(name));
  if (value.state.activeChatId === null) {
    if (Option.isSome(stored)) {
      yield* store.remove(name);
    }
    return;
  }
  const text = yield* Schema.encodeEffect(KeptChatJson)({
    state: { activeChatId: value.state.activeChatId },
    ...(value.version === undefined ? {} : { version: value.version }),
  }).pipe(Effect.orDie);
  if (!Option.contains(stored, text)) {
    yield* store.set(name, text);
  }
});

/** Forgets the chat kept under `name`. */
export const forgetKeptChat = Effect.fn("ai.kept.forget")(function* (
  name: string
) {
  const store = yield* KeyValueStore.KeyValueStore;
  yield* store.remove(name);
});

/**
 * The browser storage of Nina's store, in the shape zustand's `persist` reads. A browser that refuses its storage
 * keeps nothing, and the store goes on as a first visit does.
 */
export const keptChatStorage: PersistStorage<Kept> = {
  getItem: (name) =>
    Effect.runSync(
      readKeptChat(name).pipe(
        Effect.provide(keptStorage),
        Effect.orElseSucceed(() => null)
      )
    ),
  removeItem: (name) =>
    Effect.runSync(
      forgetKeptChat(name).pipe(
        Effect.provide(keptStorage),
        Effect.orElseSucceed(() => undefined)
      )
    ),
  setItem: (name, value) =>
    Effect.runSync(
      writeKeptChat(name, value).pipe(
        Effect.provide(keptStorage),
        Effect.orElseSucceed(() => undefined)
      )
    ),
};

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Option } from "effect";
import { KeyValueStore } from "effect/persistence";
import {
  firstPageOf,
  keepChatPlace,
  keepPlace,
  readChatPlace,
  readPlace,
} from "@/lib/scroll/place";

const mocks = vi.hoisted(() => ({ report: vi.fn() }));

vi.mock("@/lib/analytics/client", async () => {
  const { Effect: Fx } = await import("effect");
  return {
    reportClientException: (error: unknown, properties: unknown) =>
      Fx.sync(() => mocks.report(error, properties)),
  };
});

const PLACE = { depth: 42, id: "message-7", offset: -18 };

const inMemory = <A, E>(
  effect: Effect.Effect<A, E, KeyValueStore.KeyValueStore>
) => Effect.provide(effect, KeyValueStore.layerMemory);

describe("keepChatPlace", () => {
  it.effect(
    "keeps a chat's place and reads it back, and forgets it once the reader stands at the end",
    () =>
      inMemory(
        Effect.gen(function* () {
          yield* keepChatPlace("forum:a", Option.some(PLACE));
          expect(yield* readChatPlace("forum:a")).toEqual(Option.some(PLACE));
          expect(yield* readChatPlace("forum:b")).toEqual(Option.none());

          yield* keepChatPlace("forum:a", Option.none());
          expect(yield* readChatPlace("forum:a")).toEqual(Option.none());
        })
      )
  );

  it.effect(
    "remembers the sixty chats left most recently, a chat kept again counting as the newest",
    () =>
      inMemory(
        Effect.gen(function* () {
          yield* Effect.forEach(Arr.range(1, 61), (index) =>
            keepChatPlace(`chat:${index}`, Option.some(PLACE))
          );
          expect(yield* readChatPlace("chat:1")).toEqual(Option.none());
          expect(yield* readChatPlace("chat:2")).toEqual(Option.some(PLACE));

          yield* keepChatPlace("chat:2", Option.some(PLACE));
          yield* keepChatPlace("chat:62", Option.some(PLACE));
          expect(yield* readChatPlace("chat:2")).toEqual(Option.some(PLACE));
          expect(yield* readChatPlace("chat:3")).toEqual(Option.none());
        })
      )
  );

  it.effect(
    "reads storage that no longer decodes as nothing kept, and replaces it on the next write",
    () =>
      inMemory(
        Effect.gen(function* () {
          const store = yield* KeyValueStore.KeyValueStore;
          yield* store.set("nakafa-chat-places", "not json");
          expect(yield* readChatPlace("forum:a")).toEqual(Option.none());

          yield* keepChatPlace("forum:a", Option.some(PLACE));
          expect(yield* readChatPlace("forum:a")).toEqual(Option.some(PLACE));
        })
      )
  );
});

describe("keepPlace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it.effect(
    "keeps the place in the browser, where the next open reads it",
    () =>
      Effect.gen(function* () {
        yield* keepPlace("thread:1", Option.some(PLACE));

        expect(yield* readPlace("thread:1")).toEqual(Option.some(PLACE));
        expect(mocks.report).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "reports a browser that refuses its storage, and reads no place from it",
    () =>
      Effect.gen(function* () {
        const refused = vi
          .spyOn(Storage.prototype, "getItem")
          .mockImplementation(() => {
            throw new Error("refused");
          });

        yield* keepPlace("thread:1", Option.some(PLACE));
        const read = yield* readPlace("thread:1");

        refused.mockRestore();
        expect(read).toEqual(Option.none());
        expect(mocks.report).toHaveBeenCalledOnce();
      })
  );
});

describe("firstPageOf", () => {
  it("reads one page for a chat with no place, and enough to hold a deep place, within the most a read takes", () => {
    expect(firstPageOf(Option.none(), 30, 150)).toBe(30);
    expect(firstPageOf(Option.some({ ...PLACE, depth: 4 }), 30, 150)).toBe(30);
    expect(firstPageOf(Option.some(PLACE), 30, 150)).toBe(52);
    expect(firstPageOf(Option.some({ ...PLACE, depth: 400 }), 30, 150)).toBe(
      150
    );
  });
});

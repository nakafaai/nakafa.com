import { describe, expect, it } from "@effect/vitest";
import { randomUuid } from "@repo/utilities/uuid";
import { Effect } from "effect";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("randomUuid", () => {
  it.effect("generates a different version 4 UUID each time", () =>
    Effect.gen(function* () {
      const first = yield* randomUuid;
      const second = yield* randomUuid;

      expect(first).toMatch(UUID_V4);
      expect(second).toMatch(UUID_V4);
      expect(second).not.toBe(first);
    })
  );
  it.effect("dies when the runtime's random source fails", () =>
    Effect.gen(function* () {
      const failure = new Error("Random source unavailable.");
      const source = vi
        .spyOn(globalThis.crypto, "getRandomValues")
        .mockImplementation(() => {
          throw failure;
        });

      const defect = yield* randomUuid.pipe(
        Effect.catchDefect((cause) => Effect.succeed(cause)),
        Effect.ensuring(Effect.sync(() => source.mockRestore()))
      );

      expect(defect).toBe(failure);
    })
  );
});

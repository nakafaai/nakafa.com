import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { memoizeLoad } from "@/lib/chunks/load";

describe("memoizing a load", () => {
  it.effect("shares one load while it is in flight and after it succeeds", () =>
    Effect.gen(function* () {
      const load = vi.fn<() => Promise<string>>(() =>
        Promise.resolve("the module")
      );
      const request = memoizeLoad(load);

      const first = request();
      expect(request()).toBe(first);
      expect(yield* Effect.promise(() => first)).toBe("the module");
      expect(request()).toBe(first);
      expect(load).toHaveBeenCalledOnce();
    })
  );

  it.effect("starts the load again after a failure", () =>
    Effect.gen(function* () {
      const load = vi
        .fn<() => Promise<string>>()
        .mockImplementationOnce(() =>
          Promise.reject(new Error("The code is unavailable."))
        )
        .mockImplementationOnce(() => Promise.resolve("the module"));
      const request = memoizeLoad(load);

      yield* Effect.promise(() =>
        expect(request()).rejects.toThrow("The code is unavailable.")
      );
      expect(yield* Effect.promise(() => request())).toBe("the module");
      expect(load).toHaveBeenCalledTimes(2);
    })
  );
});

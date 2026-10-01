import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import {
  BrowserPlayerModeWriterLive,
  PlayerModePersistenceError,
  PlayerModeWriter,
  persistPlayerMode,
  readPlayerModeCookie,
  readPlayerModeParam,
  resolvePlayerMode,
} from "@/components/player/mode";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("player mode", () => {
  it.each([
    [{}, { kind: "absent" }],
    [{ view: "list" }, { kind: "valid", mode: "list" }],
    [{ view: "single" }, { kind: "valid", mode: "single" }],
    [{ view: "grid" }, { kind: "invalid" }],
    [{ view: "" }, { kind: "invalid" }],
    [{ view: ["list", "single"] }, { kind: "invalid" }],
  ])("classifies the view parameter %j", (searchParams, expected) => {
    expect(readPlayerModeParam(searchParams)).toEqual(expected);
  });

  it("treats a missing or unknown cookie as absent", () => {
    expect(readPlayerModeCookie(undefined)).toEqual(Option.none());
    expect(readPlayerModeCookie("grid")).toEqual(Option.none());
    expect(readPlayerModeCookie("single")).toEqual(Option.some("single"));
  });

  it("lets a lock win, then the URL, then the cookie, then the list", () => {
    const cookie = Option.some("single" as const);
    const param = { kind: "valid", mode: "list" } as const;
    expect(resolvePlayerMode({ cookie, lock: "single", param })).toBe("single");
    expect(resolvePlayerMode({ cookie, lock: null, param })).toBe("list");
    expect(
      resolvePlayerMode({ cookie, lock: null, param: { kind: "absent" } })
    ).toBe("single");
    expect(
      resolvePlayerMode({
        cookie: Option.none(),
        lock: null,
        param: { kind: "absent" },
      })
    ).toBe("list");
  });

  it.effect("serializes one year of the chosen view", () =>
    Effect.gen(function* () {
      const writes: unknown[] = [];
      const recording = Layer.succeed(PlayerModeWriter, {
        write: (input) => Effect.sync(() => writes.push(input)),
      });
      yield* persistPlayerMode("single").pipe(Effect.provide(recording));
      expect(writes).toEqual([
        {
          cookie: "player_view=single; path=/; max-age=31536000; samesite=lax",
          mode: "single",
        },
      ]);
    })
  );

  it.effect("writes the cookie and keeps the rest of the URL", () =>
    Effect.gen(function* () {
      window.history.replaceState(null, "", "/try-out?attemptId=a1#question-3");
      yield* persistPlayerMode("single").pipe(
        Effect.provide(BrowserPlayerModeWriterLive)
      );
      expect(document.cookie).toContain("player_view=single");
      expect(window.location.search).toBe("?attemptId=a1&view=single");
      expect(window.location.hash).toBe("#question-3");
    })
  );

  it.effect("reports a blocked cookie through the typed error channel", () =>
    Effect.gen(function* () {
      const cause = new Error("Cookies are disabled.");
      vi.stubGlobal("document", {
        set cookie(_cookie: string) {
          throw cause;
        },
      });
      const error = yield* persistPlayerMode("list").pipe(
        Effect.provide(BrowserPlayerModeWriterLive),
        Effect.flip
      );
      expect(error).toBeInstanceOf(PlayerModePersistenceError);
      expect(error).toMatchObject({
        _tag: "PlayerModePersistenceError",
        cause,
        message: "Failed to remember the player view.",
      });
    })
  );
});

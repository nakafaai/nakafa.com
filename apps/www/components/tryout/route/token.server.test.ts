// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { readRequestToken } from "@/components/tryout/route/token.server";

const session = vi.hoisted(() => ({ readSessionMemo: vi.fn() }));

vi.mock("@/lib/auth/session.server", () => ({
  readSessionMemo: session.readSessionMemo,
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.test/en/try-out"),
}));

describe("readRequestToken", () => {
  it.effect("answers the visitor's token from the request's session memo", () =>
    Effect.gen(function* () {
      session.readSessionMemo.mockReturnValueOnce(
        Effect.succeed(Effect.succeed({ convexToken: Option.some("token-1") }))
      );

      expect(yield* readRequestToken()).toEqual(Option.some("token-1"));
      expect(session.readSessionMemo).toHaveBeenCalledExactlyOnceWith(
        expect.any(Request)
      );
    })
  );

  it.effect("answers none for a visitor without a session", () =>
    Effect.gen(function* () {
      session.readSessionMemo.mockReturnValueOnce(
        Effect.succeed(Effect.succeed({ convexToken: Option.none() }))
      );

      expect(yield* readRequestToken()).toEqual(Option.none());
    })
  );
});

// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { memberHandler, readMemberToken } from "@/lib/tenant/member.server";
import { SchoolReadFailed } from "@/lib/tenant/read";

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

const mocks = vi.hoisted(() => ({
  readRequestToken: vi.fn<() => Effect.Effect<string | undefined, never>>(),
  setResponseHeader: vi.fn<(name: string, value: string) => void>(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://harapan.nakafa.com/"),
  setResponseHeader: mocks.setResponseHeader,
}));

vi.mock("@/lib/auth/session.server", () => ({
  readRequestToken: mocks.readRequestToken,
}));

vi.mock("@/lib/tenant/read", async () => {
  const { Schema } = await import("effect");
  return {
    SchoolReadFailed: class SchoolReadFailed extends Schema.TaggedError<SchoolReadFailed>()(
      "SchoolReadFailed",
      { cause: Schema.Unknown }
    ) {},
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("school member token", () => {
  it.effect("reads the request's token for a member", () =>
    Effect.gen(function* () {
      mocks.readRequestToken.mockReturnValue(Effect.succeed("token-1"));

      expect(yield* readMemberToken()).toBe("token-1");
    })
  );

  it.effect("fails the read for a request with no session token", () =>
    Effect.gen(function* () {
      mocks.readRequestToken.mockReturnValue(
        Effect.void.pipe(Effect.as(undefined))
      );

      const failure = yield* readMemberToken().pipe(Effect.flip);

      expect(failure).toBeInstanceOf(SchoolReadFailed);
    })
  );
});

describe("school member handler", () => {
  it("answers private and runs the effect with the member's token", async () => {
    mocks.readRequestToken.mockReturnValue(Effect.succeed("token-2"));
    const handler = memberHandler(
      (data: { readonly id: string }, token: string) =>
        Effect.succeed({ id: data.id, token })
    );

    const answer = await handler({ data: { id: "exam-1" } });

    expect(answer).toStrictEqual({ id: "exam-1", token: "token-2" });
    expect(mocks.setResponseHeader).toHaveBeenCalledExactlyOnceWith(
      "cache-control",
      "private, no-store"
    );
  });

  it("fails a request with no session token before the effect runs", async () => {
    mocks.readRequestToken.mockReturnValue(
      Effect.void.pipe(Effect.as(undefined))
    );
    const run = vi.fn(() => Effect.succeed("never"));
    const handler = memberHandler(run);

    await expect(handler({ data: {} })).rejects.toBeInstanceOf(
      SchoolReadFailed
    );
    expect(run).not.toHaveBeenCalled();
  });
});

// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import {
  appendResponseHeader,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { Effect, Option } from "effect";
import {
  readSessionClient,
  sessionFn,
  sessionHandler,
} from "@/lib/auth/session.fn";

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

vi.mock("@tanstack/react-start/server", () => ({
  appendResponseHeader: vi.fn(),
  getRequest: () => new Request("https://nakafa.com/"),
  setResponseHeader: vi.fn(),
}));

vi.mock("@/lib/auth/session.server", () => ({
  createRequestSession: () =>
    Effect.succeed(
      Effect.succeed({
        client: { _tag: "SignedOut" },
        convexToken: Option.none(),
        setCookies: ["better-auth.session_token=; Path=/; Max-Age=0"],
      })
    ),
}));

describe("session server function", () => {
  it.effect(
    "answers the visitor without a token, and keeps the answer uncached",
    () =>
      Effect.gen(function* () {
        const client = yield* readSessionClient();
        expect(client).toStrictEqual({ _tag: "SignedOut" });
        expect(setResponseHeader).toHaveBeenCalledWith(
          "cache-control",
          "private, no-store"
        );
        expect(appendResponseHeader).toHaveBeenCalledWith(
          "set-cookie",
          "better-auth.session_token=; Path=/; Max-Age=0"
        );
      })
  );

  it("exposes the session as a server function", () => {
    expect(typeof sessionFn).toBe("function");
  });

  it("answers the same session through the server handler", async () => {
    await expect(sessionHandler({ data: undefined })).resolves.toStrictEqual({
      _tag: "SignedOut",
    });
  });
});

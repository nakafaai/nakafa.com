// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { serveConnectCallback } from "@/lib/connectors/callback.server";

/** The calls that the Convex HTTP client receives, as doubles. */
const convex = vi.hoisted(() => ({
  action: vi.fn<(reference: unknown, args: unknown) => Promise<unknown>>(),
  setAuth: vi.fn<(token: string) => void>(),
  token: vi.fn<() => string | undefined>(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    action(reference: unknown, args: unknown) {
      return convex.action(reference, args);
    }
    setAuth(token: string) {
      convex.setAuth(token);
    }
  },
}));

vi.mock("@/lib/auth/session.server", async () => {
  const { Effect: effect } = await import("effect");
  return {
    readRequestToken: () =>
      effect.suspend(() => {
        const token = convex.token();
        return token === "unreadable"
          ? effect.fail(new Error("The session did not answer."))
          : effect.succeed(token);
      }),
  };
});

process.env.VITE_CONVEX_URL = "https://example.convex.cloud";

/** One callback request of Google with its query. */
const callback = (query: string) =>
  new Request(`https://nakafa.com/api/connectors/google/callback${query}`);

describe("serveConnectCallback", () => {
  it.effect(
    "finishes the connect with the visitor's token and redirects to the page it answers, with the outcome",
    () =>
      Effect.gen(function* () {
        convex.token.mockReturnValue("token-1");
        convex.action.mockResolvedValueOnce({
          location: "https://harapan.nakafa.com/settings/connections",
          outcome: "connected",
        });
        const response = yield* serveConnectCallback(
          callback("?code=code-1&state=state-1")
        );
        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe(
          "https://harapan.nakafa.com/settings/connections?connect=connected"
        );
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(convex.setAuth).toHaveBeenCalledWith("token-1");
        expect(convex.action.mock.calls[0]?.[1]).toEqual({
          code: "code-1",
          state: "state-1",
        });
      })
  );

  it.effect(
    "goes home without a state, without a session, with a session it cannot read, or when the connect cannot finish",
    () =>
      Effect.gen(function* () {
        convex.token.mockReturnValue("token-1");
        const home = "https://nakafa.com/";
        expect(
          (yield* serveConnectCallback(callback("?code=c"))).headers.get(
            "location"
          )
        ).toBe(home);
        convex.action.mockRejectedValueOnce(new Error("expired"));
        expect(
          (yield* serveConnectCallback(callback("?state=s"))).headers.get(
            "location"
          )
        ).toBe(home);
        convex.token.mockReturnValue("unreadable");
        expect(
          (yield* serveConnectCallback(callback("?state=s"))).headers.get(
            "location"
          )
        ).toBe(home);
        convex.token.mockReturnValue(undefined);
        expect(
          (yield* serveConnectCallback(callback("?state=s"))).headers.get(
            "location"
          )
        ).toBe(home);
      })
  );
});

// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import {
  appendResponseHeader,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { Array as Arr, Effect, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import {
  readSessionClient,
  readSessionMemo,
  sessionHandler,
} from "@/lib/auth/session.server";
import { ClientSession } from "@/lib/auth/visitor";

process.env.VITE_CONVEX_SITE_URL = "https://example.convex.site";

/** The request that the server is handling, which the mocked server helpers read. */
const current = vi.hoisted(() => ({
  request: new Request("https://nakafa.com/"),
}));

vi.mock("@tanstack/react-start/server", () => ({
  appendResponseHeader: vi.fn(),
  getRequest: () => current.request,
  setResponseHeader: vi.fn(),
}));

/** The Convex site answers every session read through this one fetch double. */
const fetcher = vi.fn<typeof fetch>();

/** A request from a signed-in visitor on the main host. */
const signedInRequest = () =>
  new Request("https://nakafa.com/", {
    headers: { cookie: "better-auth.session_token=abc" },
  });

/** The session route's answer for one account, with its Set-Cookie values. */
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

const answer = (cookies: readonly string[] = []) =>
  new Response(
    encodeJson({
      session: { id: "session-1" },
      user: { id: "user-1", name: "Ada" },
    }),
    {
      headers: [
        ["content-type", "application/json"],
        ...Arr.map(cookies, (cookie): [string, string] => [
          "set-cookie",
          cookie,
        ]),
      ],
    }
  );

describe("session client answer", () => {
  it.effect("answers a visitor without a cookie with no network call", () =>
    Effect.gen(function* () {
      vi.clearAllMocks();
      current.request = new Request("https://nakafa.com/");
      const client = yield* readSessionClient();
      expect(client._tag).toBe("SignedOut");
      expect(setResponseHeader).toHaveBeenCalledWith(
        "cache-control",
        "private, no-store"
      );
      expect(fetcher).not.toHaveBeenCalled();
    }).pipe(Effect.provideService(FetchHttpClient.Fetch, fetcher))
  );

  it("answers the server function handler with the same visitor session", async () => {
    vi.clearAllMocks();
    current.request = new Request("https://nakafa.com/");
    const client = await sessionHandler({ data: undefined });
    expect(client).toStrictEqual(ClientSession.cases.SignedOut.make({}));
  });
});

describe("request session memo", () => {
  it.effect("reads the session once for every reader of one request", () =>
    Effect.gen(function* () {
      vi.clearAllMocks();
      const request = signedInRequest();
      current.request = request;
      fetcher.mockResolvedValueOnce(answer(["convex_jwt=token-ada; Path=/"]));
      const first = yield* readSessionMemo(request);
      const second = yield* readSessionMemo(request);
      yield* first;
      const client = yield* readSessionClient();
      yield* second;
      expect(client._tag).toBe("SignedIn");
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(appendResponseHeader).toHaveBeenCalledTimes(1);
      expect(appendResponseHeader).toHaveBeenCalledWith(
        "set-cookie",
        "convex_jwt=token-ada; Path=/"
      );
    }).pipe(Effect.provideService(FetchHttpClient.Fetch, fetcher))
  );

  it.effect("gives each request its own session", () =>
    Effect.gen(function* () {
      vi.clearAllMocks();
      fetcher
        .mockResolvedValueOnce(answer(["convex_jwt=token-1; Path=/"]))
        .mockResolvedValueOnce(answer(["convex_jwt=token-2; Path=/"]));
      yield* yield* readSessionMemo(signedInRequest());
      yield* yield* readSessionMemo(signedInRequest());
      expect(fetcher).toHaveBeenCalledTimes(2);
    }).pipe(Effect.provideService(FetchHttpClient.Fetch, fetcher))
  );
});

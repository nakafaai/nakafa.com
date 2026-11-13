// @vitest-environment node
import { AUTH_JWT_COOKIE, AUTH_REFRESH_COOKIE } from "@convex-dev/auth/ssr";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  appendResponseHeader,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { Array as Arr, Effect, Schema } from "effect";
import { Base64Url } from "effect/encoding";
import {
  readRequestToken,
  readSessionClient,
  readSessionMemo,
  sessionHandler,
} from "@/lib/auth/session.server";
import { ClientSession } from "@/lib/auth/visitor";

/** The request that the server is handling, which the mocked server helpers read. */
const current = vi.hoisted(() => ({
  request: new Request("https://nakafa.com/"),
}));

vi.mock("@tanstack/react-start/server", () => ({
  appendResponseHeader: vi.fn(),
  getRequest: () => current.request,
  setResponseHeader: vi.fn(),
}));

/** The deployment's answers, one double for the file (AGENTS.md). */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);

/** The JSON text of one body. */
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** A fresh access token of `session-1`. */
const TOKEN = Arr.join(
  [
    Base64Url.encode(encodeJson({ alg: "ES256", typ: "JWT" })),
    Base64Url.encode(encodeJson({ exp: 4_102_444_800, sub: "session-1" })),
    "signature",
  ],
  "."
);

/** The deployment's answer to a function that returned `value`. */
const success = (value: unknown) =>
  Response.json({ logLines: [], status: "success", value });

/** Answers the refresh with a rotated session and the account read with Ada. */
function answerSignedIn() {
  fetcher.mockImplementation((input) =>
    Promise.resolve(
      new URL(String(input)).pathname === "/api/mutation"
        ? success({
            kind: "rotated",
            tokens: {
              accessToken: TOKEN,
              refreshToken: "next-refresh",
              refreshTokenExpiresAt: 4_102_444_800_000,
              userId: "user-1",
            },
          })
        : success({ appUser: { _id: "user-1", name: "Ada" } })
    )
  );
}

/** A request from a signed-in visitor whose access token is due. */
const signedInRequest = () =>
  new Request("https://nakafa.com/", {
    headers: { cookie: `${AUTH_REFRESH_COOKIE}=refresh` },
  });

beforeEach(() => {
  vi.clearAllMocks();
  fetcher.mockReset();
  vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
  vi.stubEnv("SITE_URL", "https://nakafa.com");
});

describe("session client answer", () => {
  it.effect("answers a visitor without a cookie with no network call", () =>
    Effect.gen(function* () {
      current.request = new Request("https://nakafa.com/");
      const client = yield* readSessionClient();
      expect(client._tag).toBe("SignedOut");
      expect(setResponseHeader).toHaveBeenCalledWith(
        "cache-control",
        "private, no-store"
      );
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it("answers the server function handler with the same visitor session", async () => {
    current.request = new Request("https://nakafa.com/");
    const client = await sessionHandler({ data: undefined });
    expect(client).toStrictEqual(ClientSession.cases.SignedOut.make({}));
  });
});

describe("request session memo", () => {
  it.effect("reads the session once for every reader of one request", () =>
    Effect.gen(function* () {
      answerSignedIn();
      const request = signedInRequest();
      current.request = request;
      const first = yield* readSessionMemo(request);
      const second = yield* readSessionMemo(request);
      yield* first;
      const client = yield* readSessionClient();
      const token = yield* readRequestToken(request);
      yield* second;
      expect(client._tag).toBe("SignedIn");
      expect(token).toBe(TOKEN);
      // One refresh and one account read, whoever asks.
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(
        Arr.map(vi.mocked(appendResponseHeader).mock.calls, ([name, value]) => [
          name,
          String(value).split(";")[0],
        ])
      ).toEqual([
        ["set-cookie", `${AUTH_JWT_COOKIE}=${TOKEN}`],
        ["set-cookie", `${AUTH_REFRESH_COOKIE}=next-refresh`],
      ]);
    })
  );

  it.effect("gives each request its own session", () =>
    Effect.gen(function* () {
      answerSignedIn();
      yield* yield* readSessionMemo(signedInRequest());
      yield* yield* readSessionMemo(signedInRequest());
      expect(fetcher).toHaveBeenCalledTimes(4);
    })
  );
});

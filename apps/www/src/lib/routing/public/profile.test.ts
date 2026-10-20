// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import auth from "@repo/backend/confect/_generated/refs/auth";
import { Effect, Layer } from "effect";
import { clientEnv } from "@/env.public";
import { readPublicUrlMigrationRedirect } from "@/lib/routing/public/migration";
import { readProfileRedirect } from "@/lib/routing/public/profile";

const mocks = vi.hoisted(() => ({
  layerOptions: vi.fn(),
  query: vi.fn(),
  token: vi.fn(),
}));
vi.mock("@/lib/auth/token", () => ({ readSessionToken: mocks.token }));
vi.mock("@/lib/content/article/category", () => ({
  hasPublishedArticleCategory: vi.fn(),
}));
vi.mock("@/lib/content/published/route", () => ({
  readActiveContentRoute: vi.fn(),
}));
vi.mock("@/lib/routing/public/tryout", () => ({
  readTryoutRedirect: () => Effect.succeed(null),
}));
vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) => {
        mocks.layerOptions(args[1]);
        return Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return { ...client, query: mocks.query };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args)));
      },
    },
  };
});

const ID = "kn7d517e2jtf7kq3m7evvp4dhd7s39p1";
const OTHER_ID = "kn7ab0c1d2e3f4g5h6i7j8k9l0m1n2o3";
const TOKEN = "session-token";

/** The signed-in account that the id address names, as `getCurrentUser` answers it. */
const accountOf = (appUser: { _id: string; username?: string }) =>
  Effect.succeed({ appUser });

/** Signs the request in: the session cookie is read as a token. */
const signedIn = () => mocks.token.mockReturnValue(Effect.succeed(TOKEN));

const headers = new Headers({ cookie: "session=1" });

describe("retired profile address redirects", () => {
  beforeEach(() => {
    mocks.layerOptions.mockReset();
    mocks.query.mockReset();
    mocks.token.mockReset();
  });

  it.effect.each([
    [`/id/user/${ID}`, "/id/@nabilfatih"],
    [`/en/user/${ID}`, "/en/@nabilfatih"],
    [`/de/user/${ID}/chat`, "/de/@nabilfatih/chat"],
    [`/en/user/${ID}/comments`, "/en/@nabilfatih/comments"],
  ])(
    "sends the id address %s of the signed-in account to %s for good",
    ([pathname, destination]) =>
      Effect.gen(function* () {
        signedIn();
        mocks.query.mockReturnValue(
          accountOf({ _id: ID, username: "nabilfatih" })
        );

        expect(yield* readProfileRedirect(pathname, headers)).toEqual({
          destination,
          status: 308,
        });
        expect(mocks.token).toHaveBeenCalledWith(
          clientEnv.VITE_CONVEX_SITE_URL,
          headers
        );
        expect(mocks.layerOptions).toHaveBeenCalledWith({ auth: TOKEN });
        expect(mocks.query).toHaveBeenCalledOnce();
        expect(mocks.query.mock.calls[0]?.[0]).toBe(
          auth.queries.getCurrentUser
        );
      })
  );

  it.effect("sends nobody on without a session and asks no account", () =>
    Effect.gen(function* () {
      mocks.token.mockReturnValue(Effect.void);

      expect(yield* readProfileRedirect(`/id/user/${ID}`, headers)).toBeNull();
      expect(mocks.query).not.toHaveBeenCalled();
    })
  );

  it.effect("leaves the id of another account to route ownership", () =>
    Effect.gen(function* () {
      signedIn();
      mocks.query.mockReturnValue(
        accountOf({ _id: OTHER_ID, username: "someoneelse" })
      );

      expect(yield* readProfileRedirect(`/id/user/${ID}`, headers)).toBeNull();
      expect(mocks.query).toHaveBeenCalledOnce();
    })
  );

  it.effect("leaves a session that names no account to route ownership", () =>
    Effect.gen(function* () {
      signedIn();
      mocks.query.mockReturnValue(Effect.succeed(null));

      expect(yield* readProfileRedirect(`/id/user/${ID}`, headers)).toBeNull();
    })
  );

  it.effect("leaves an account without a username to route ownership", () =>
    Effect.gen(function* () {
      signedIn();
      mocks.query.mockReturnValue(accountOf({ _id: ID }));

      expect(yield* readProfileRedirect(`/id/user/${ID}`, headers)).toBeNull();
    })
  );

  it.effect.each([
    "/id",
    "/id/user",
    "/id/user/settings",
    "/id/user/settings/memory",
    `/id/user/${ID}/chat/more`,
    `/id/search/${ID}`,
    "/id/@nabilfatih",
    "/id/@nabilfatih/chat",
    `/fr/user/${ID}`,
    `/user/${ID}`,
  ])("asks nobody about the path %s", (pathname) =>
    Effect.gen(function* () {
      expect(yield* readProfileRedirect(pathname, headers)).toBeNull();
      expect(mocks.token).not.toHaveBeenCalled();
      expect(mocks.query).not.toHaveBeenCalled();
    })
  );

  it.effect("is one of the retired public URLs that the proxy redirects", () =>
    Effect.gen(function* () {
      signedIn();
      mocks.query.mockReturnValue(
        accountOf({ _id: ID, username: "nabilfatih" })
      );

      expect(
        yield* readPublicUrlMigrationRedirect({
          hasAttemptCapability: false,
          headers,
          method: "GET",
          pathname: `/id/user/${ID}`,
        })
      ).toEqual({ destination: "/id/@nabilfatih", status: 308 });
      expect(
        yield* readPublicUrlMigrationRedirect({
          hasAttemptCapability: false,
          headers,
          method: "POST",
          pathname: `/id/user/${ID}`,
        })
      ).toBeNull();
      expect(mocks.query).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "does not redirect a request for the Markdown version of a profile, which has none",
    () =>
      Effect.gen(function* () {
        signedIn();
        mocks.query.mockReturnValue(
          accountOf({ _id: ID, username: "nabilfatih" })
        );

        expect(
          yield* readPublicUrlMigrationRedirect({
            hasAttemptCapability: false,
            headers,
            markdown: true,
            method: "GET",
            pathname: `/id/user/${ID}`,
          })
        ).toBeNull();
        expect(mocks.token).not.toHaveBeenCalled();
        expect(mocks.query).not.toHaveBeenCalled();
      })
  );
});

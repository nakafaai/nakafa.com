// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { readPublicUrlMigrationRedirect } from "@/lib/routing/public/migration";
import { readProfileRedirect } from "@/lib/routing/public/profile";

const readUsernameQueryMock = vi.hoisted(() => vi.fn());
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
      layer: (...args: Parameters<typeof HttpClient.layer>) =>
        Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return { ...client, query: readUsernameQueryMock };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});

const ID = "kn7d517e2jtf7kq3m7evvp4dhd7s39p1";

describe("retired profile address redirects", () => {
  beforeEach(() => {
    readUsernameQueryMock.mockReset();
  });

  it.effect.each([
    ["/id/user/kn7d517e2jtf7kq3m7evvp4dhd7s39p1", "/id/@nabilfatih"],
    ["/en/user/kn7d517e2jtf7kq3m7evvp4dhd7s39p1", "/en/@nabilfatih"],
    ["/de/user/kn7d517e2jtf7kq3m7evvp4dhd7s39p1/chat", "/de/@nabilfatih/chat"],
  ])(
    "sends the id address %s to %s with a temporary redirect, because a rename moves the username",
    ([pathname, destination]) =>
      Effect.gen(function* () {
        readUsernameQueryMock.mockReturnValue(Effect.succeed("nabilfatih"));

        expect(yield* readProfileRedirect(pathname)).toEqual({
          destination,
          status: 307,
        });
        expect(readUsernameQueryMock).toHaveBeenCalledOnce();
        expect(readUsernameQueryMock.mock.calls[0]?.[1]).toEqual({
          userId: ID,
        });
      })
  );

  it.effect("is one of the retired public URLs that the proxy redirects", () =>
    Effect.gen(function* () {
      readUsernameQueryMock.mockReturnValue(Effect.succeed("nabilfatih"));

      expect(
        yield* readPublicUrlMigrationRedirect({
          hasAttemptCapability: false,
          method: "GET",
          pathname: `/id/user/${ID}`,
        })
      ).toEqual({ destination: "/id/@nabilfatih", status: 307 });
      expect(
        yield* readPublicUrlMigrationRedirect({
          hasAttemptCapability: false,
          method: "POST",
          pathname: `/id/user/${ID}`,
        })
      ).toBeNull();
      expect(readUsernameQueryMock).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "leaves the id of an account without a username to route ownership",
    () =>
      Effect.gen(function* () {
        readUsernameQueryMock.mockReturnValue(Effect.succeed(null));

        expect(yield* readProfileRedirect(`/id/user/${ID}`)).toBeNull();
        expect(readUsernameQueryMock).toHaveBeenCalledOnce();
      })
  );

  it.effect.each([
    "/id",
    "/id/user",
    "/id/user/settings",
    "/id/user/settings/memory",
    `/id/user/${ID}/comments`,
    `/id/user/${ID}/chat/more`,
    `/id/search/${ID}`,
    "/id/@nabilfatih",
    "/id/@nabilfatih/chat",
    `/fr/user/${ID}`,
    `/user/${ID}`,
  ])("asks nobody about the path %s", (pathname) =>
    Effect.gen(function* () {
      expect(yield* readProfileRedirect(pathname)).toBeNull();
      expect(readUsernameQueryMock).not.toHaveBeenCalled();
    })
  );
});

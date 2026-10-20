// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import contents from "@repo/backend/confect/_generated/refs/contents";
import { Effect, Layer } from "effect";
import { getHomeTrendingSubjects } from "@/lib/content/trending";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("@/env.client", () => ({
  clientEnv: { VITE_CONVEX_URL: "https://test.convex.cloud" },
}));
vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient: Client } =
    await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...Client,
      layer: (...args: Parameters<typeof Client.layer>) =>
        Layer.effect(
          Client.HttpClient,
          Effect.gen(function* () {
            const client = yield* Client.HttpClient;
            return { ...client, query: queryMock };
          })
        ).pipe(Layer.provide(Client.layer(...args))),
    },
  };
});

describe("home trending subjects", () => {
  beforeEach(() => {
    queryMock.mockReset().mockReturnValue(Effect.succeed([]));
  });

  it("asks Convex for the ranking of one locale", async () => {
    await getHomeTrendingSubjects("id");

    expect(queryMock).toHaveBeenCalledExactlyOnceWith(
      contents.queries.trending.getTrendingSubjects,
      { locale: "id" }
    );
  });

  it("keeps the seven day ranking for hours, not for a minute", async () => {
    await getHomeTrendingSubjects("en");
  });
});

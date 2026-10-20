// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import contents from "@repo/backend/confect/_generated/refs/contents";
import { Duration, Effect, Layer } from "effect";
import { readHomeTrendingSubjects } from "@/lib/content/trending";

const mocks = vi.hoisted(() => ({
  queryMock: vi.fn(),
  readStoreEntry: vi.fn(),
  writeStoreEntry: vi.fn(),
}));

vi.mock("@/env.public", () => ({
  clientEnv: { VITE_CONVEX_URL: "https://test.convex.cloud" },
}));

vi.mock("@/lib/content/store/entry", () => ({
  readStoreEntry: mocks.readStoreEntry,
  writeStoreEntry: mocks.writeStoreEntry,
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
            return { ...client, query: mocks.queryMock };
          })
        ).pipe(Layer.provide(Client.layer(...args))),
    },
  };
});

describe("home trending subjects", () => {
  beforeEach(() => {
    mocks.queryMock.mockReset().mockReturnValue(Effect.succeed([]));
    mocks.readStoreEntry.mockReset().mockReturnValue(Effect.succeedNone);
    mocks.writeStoreEntry.mockReset().mockReturnValue(Effect.void);
  });

  it.effect(
    "asks the deployment for the ranking of one locale when the store has none",
    () =>
      Effect.gen(function* () {
        yield* readHomeTrendingSubjects("id");

        expect(mocks.queryMock).toHaveBeenCalledExactlyOnceWith(
          contents.queries.trending.getTrendingSubjects,
          { locale: "id" }
        );
      })
  );

  it.effect("stores the ranking for an hour under the trending tag", () =>
    Effect.gen(function* () {
      yield* readHomeTrendingSubjects("en");

      expect(mocks.writeStoreEntry).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          parts: ["trending", "en"],
          tags: ["trending"],
          ttl: Duration.hours(1),
          value: [],
        })
      );
    })
  );

  it.effect(
    "answers from the store while it is fresh, without a read of the deployment",
    () =>
      Effect.gen(function* () {
        mocks.readStoreEntry.mockReturnValue(Effect.succeedSome([]));

        expect(yield* readHomeTrendingSubjects("en")).toStrictEqual([]);
        expect(mocks.queryMock).not.toHaveBeenCalled();
        expect(mocks.writeStoreEntry).not.toHaveBeenCalled();
      })
  );
});

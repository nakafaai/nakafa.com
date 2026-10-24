// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { makeTryoutRuntimeSource } from "@repo/backend/test/tryout/serving";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import { Effect, Layer } from "effect";
import { getMetadataFromSlug } from "@/lib/og/metadata";
import { activateTestRelease } from "@/test/active";
import { resetTestRuntimeCache } from "@/test/store";

const routeMocks = vi.hoisted(() => ({
  read: vi.fn(),
}));
const mockGetTranslations = vi.hoisted(() => vi.fn());
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
            return {
              ...client,
              query: routeMocks.read,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});
vi.mock("@repo/internationalization/src/translator", () => ({
  readServerTranslator: mockGetTranslations,
}));
vi.mock(
  "@/lib/content/published/active",
  async () => (await import("@/test/active")).testActiveModule
);
vi.mock(
  "@/lib/content/store/memory",
  async () => (await import("@/test/store")).testRuntimeCacheModule
);
const translatedDefaults = {
  authors: [
    {
      name: "Nakafa",
    },
  ],
  date: "",
  description: "Short description",
  title: "Made with love",
};
beforeEach(() => {
  resetTestRuntimeCache();
  activateTestRelease("release-metadata");
  routeMocks.read.mockReset();
  mockGetTranslations.mockReset();
  routeMocks.read.mockReturnValue(
    Effect.succeed({
      description: "Runtime description",
      title: "Runtime title",
    })
  );
  mockGetTranslations.mockImplementation(({ namespace }) => {
    if (namespace === "Common") {
      return Promise.resolve((key: string) =>
        key === "made-with-love" ? "Made with love" : key
      );
    }
    return Promise.resolve((key: string) =>
      key === "short-description" ? "Short description" : key
    );
  });
});
describe("current content reference metadata", () => {
  it.effect(
    "uses signed snapshot metadata and keeps defaults for absent routes",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeTryoutRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        routeMocks.read.mockImplementation(context.query);
        expect(
          yield* getMetadataFromSlug("en", ["try-out", "indonesia"])
        ).toMatchObject({
          title: "Indonesia",
          authors: [
            {
              name: "Nakafa",
            },
          ],
        });
        expect(
          yield* getMetadataFromSlug("en", ["try-out", "missing-country"])
        ).toEqual(translatedDefaults);
      })
  );
  it.effect("reads complete metadata from the current signed reference", () =>
    Effect.gen(function* () {
      expect(yield* getMetadataFromSlug("en", ["quran", "1"])).toEqual({
        authors: [
          {
            name: "Nakafa",
          },
        ],
        date: "",
        description: "Runtime description",
        title: "Runtime title",
      });
    })
  );
  it.effect(
    "uses translated defaults when the current reference has no row",
    () =>
      Effect.gen(function* () {
        routeMocks.read.mockReturnValueOnce(Effect.succeed(null));
        expect(yield* getMetadataFromSlug("id", ["quran", "missing"])).toEqual(
          translatedDefaults
        );
      })
  );
  it.effect("preserves typed current-reference read failures", () =>
    Effect.gen(function* () {
      routeMocks.read.mockReturnValueOnce(
        Effect.fail(
          new NakafaAgentDataReadError({
            cause: "Route catalog unavailable.",
            message: "Unable to read route catalog.",
          })
        )
      );
      const error = yield* Effect.flip(
        getMetadataFromSlug("id", ["quran", "failed"])
      );
      expect(error).toBeInstanceOf(NakafaAgentDataReadError);
    })
  );
  it.effect("fills sparse current metadata from translations", () =>
    Effect.gen(function* () {
      routeMocks.read.mockReturnValueOnce(
        Effect.succeed({
          description: undefined,
          title: "",
        })
      );
      expect(yield* getMetadataFromSlug("en", ["quran", "sparse"])).toEqual(
        translatedDefaults
      );
    })
  );
  it.effect("reports which translation namespace failed", () =>
    Effect.gen(function* () {
      mockGetTranslations.mockRejectedValueOnce(new Error("Missing Common."));
      expect(
        yield* getMetadataFromSlug("en", ["quran", "1"]).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "TranslationLoadError",
        locale: "en",
        namespace: "Common",
      });
      mockGetTranslations.mockImplementation(({ namespace }) => {
        if (namespace === "Common") {
          return Promise.resolve(() => "Made with love");
        }
        return Promise.reject(new Error("Missing Metadata."));
      });
      expect(
        yield* getMetadataFromSlug("en", ["quran", "1"]).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "TranslationLoadError",
        locale: "en",
        namespace: "Metadata",
      });
    })
  );
  it.effect(
    "keeps a translation-only route independent of content publication",
    () =>
      Effect.gen(function* () {
        routeMocks.read.mockReturnValueOnce(Effect.succeed(null));
        expect(yield* getMetadataFromSlug("en", ["pricing"])).toEqual(
          translatedDefaults
        );
      })
  );
});

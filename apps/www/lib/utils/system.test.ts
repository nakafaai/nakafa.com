// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { Effect } from "effect";
import { vi } from "vitest";
import {
  getCachedMetadataFromSlug,
  getMetadataFromSlug,
} from "@/lib/utils/system";

const routeMocks = vi.hoisted(() => ({
  read: vi.fn(),
}));
const cacheMocks = vi.hoisted(() => ({
  life: vi.fn(),
  tag: vi.fn(),
}));
const mockGetTranslations = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: routeMocks.read,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mockGetTranslations,
}));

vi.mock("next/cache", () => ({
  cacheLife: cacheMocks.life,
  cacheTag: cacheMocks.tag,
}));

const translatedDefaults = {
  authors: [{ name: "Nakafa" }],
  date: "",
  description: "Short description",
  title: "Made with love",
};

beforeEach(() => {
  routeMocks.read.mockReset();
  cacheMocks.life.mockClear();
  cacheMocks.tag.mockClear();
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
  it.effect("reads complete metadata from the current signed reference", () =>
    Effect.gen(function* () {
      expect(yield* getMetadataFromSlug("en", ["quran", "1"])).toEqual({
        authors: [{ name: "Nakafa" }],
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

  it.effect("applies the content cache at the route-handler boundary", () =>
    Effect.gen(function* () {
      const metadata = yield* Effect.promise(() =>
        getCachedMetadataFromSlug("en", ["quran", "1"])
      );

      expect(metadata).toMatchObject({ title: "Runtime title" });
      expect(cacheMocks.tag).toHaveBeenCalledWith("content-runtime");
      expect(cacheMocks.life).toHaveBeenCalledWith("contentRuntime");
    })
  );
});

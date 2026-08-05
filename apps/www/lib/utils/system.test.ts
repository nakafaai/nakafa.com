// @vitest-environment node

import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRoute: routeMocks.read,
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
      authors: [{ name: "Nakafa" }],
      date: new Date("2025-01-02").getTime(),
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

describe("route catalog metadata", () => {
  it("reads complete metadata from the runtime catalog", async () => {
    await expect(
      Effect.runPromise(getMetadataFromSlug("en", ["quran", "1"]))
    ).resolves.toEqual({
      authors: [{ name: "Nakafa" }],
      date: "2025-01-02T00:00:00.000Z",
      description: "Runtime description",
      title: "Runtime title",
    });
  });

  it("uses translated defaults when the catalog has no row", async () => {
    routeMocks.read.mockReturnValueOnce(Effect.succeed(null));
    await expect(
      Effect.runPromise(getMetadataFromSlug("id", ["quran", "missing"]))
    ).resolves.toEqual(translatedDefaults);
  });

  it("preserves typed route-catalog read failures", async () => {
    routeMocks.read.mockReturnValueOnce(
      Effect.fail(
        new NakafaAgentDataReadError({
          cause: "Route catalog unavailable.",
          message: "Unable to read route catalog.",
        })
      )
    );

    const error = await Effect.runPromise(
      Effect.flip(getMetadataFromSlug("id", ["quran", "failed"]))
    );

    expect(error).toBeInstanceOf(NakafaAgentDataReadError);
  });

  it("fills sparse runtime metadata from translations", async () => {
    routeMocks.read.mockReturnValueOnce(
      Effect.succeed({
        authors: [{ name: "Nakafa" }],
        date: undefined,
        description: undefined,
        title: "",
      })
    );

    await expect(
      Effect.runPromise(getMetadataFromSlug("en", ["quran", "sparse"]))
    ).resolves.toEqual(translatedDefaults);
  });

  it("reports which translation namespace failed", async () => {
    mockGetTranslations.mockRejectedValueOnce(new Error("Missing Common."));
    await expect(
      Effect.runPromise(getMetadataFromSlug("en", ["quran", "1"]))
    ).rejects.toThrow('"namespace": "Common"');

    mockGetTranslations.mockImplementation(({ namespace }) => {
      if (namespace === "Common") {
        return Promise.resolve(() => "Made with love");
      }
      return Promise.reject(new Error("Missing Metadata."));
    });
    await expect(
      Effect.runPromise(getMetadataFromSlug("en", ["quran", "1"]))
    ).rejects.toThrow('"namespace": "Metadata"');
  });

  it("applies the content cache at the route-handler boundary", async () => {
    await expect(
      getCachedMetadataFromSlug("en", ["quran", "1"])
    ).resolves.toMatchObject({ title: "Runtime title" });
    expect(cacheMocks.tag).toHaveBeenCalledWith("content-runtime");
    expect(cacheMocks.life).toHaveBeenCalledWith("contentRuntime");
  });
});

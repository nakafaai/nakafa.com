// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";
import { getCachedSEOMetadata } from "@/lib/seo/cache";

const mocks = vi.hoisted(() => ({
  cacheLife: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("next/cache", () => ({ cacheLife: mocks.cacheLife }));
vi.mock("@/lib/seo/generator", () => ({
  generateSEOMetadata: mocks.generate,
}));

beforeEach(() => {
  mocks.cacheLife.mockReset();
  mocks.generate.mockReset();
  mocks.generate.mockReturnValue(
    Effect.succeed({
      description: "Learn functions.",
      keywords: ["functions"],
      title: "Functions",
    })
  );
});

describe("SEO cache boundary", () => {
  it.effect("runs the native generator inside the maximum cache profile", () =>
    Effect.gen(function* () {
      const context = {
        type: "material-lesson" as const,
        data: { title: "Functions" },
        grade: "12" as const,
        material: "mathematics" as const,
      };
      const result = yield* Effect.tryPromise({
        try: () => getCachedSEOMetadata(context, "en"),
        catch: (cause) => String(cause),
      });

      expect(result).toMatchObject({ title: "Functions" });
      expect(mocks.cacheLife).toHaveBeenCalledWith("max");
      expect(mocks.generate).toHaveBeenCalledWith(context, "en");
    })
  );
});

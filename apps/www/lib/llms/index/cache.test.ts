// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";
import { getCachedLlmsSectionIndexText } from "@/lib/llms/index/cache";

const mockApplyContentRuntimeCache = vi.hoisted(() => vi.fn());
const mockGetLlmsSectionIndexText = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: mockApplyContentRuntimeCache,
}));
vi.mock("@/lib/llms/index/generate", () => ({
  getLlmsSectionIndexText: mockGetLlmsSectionIndexText,
}));

beforeEach(() => {
  mockApplyContentRuntimeCache.mockReset();
  mockGetLlmsSectionIndexText.mockReset();
});

describe("LLMS index cache", () => {
  it.effect("applies the content cache without changing generated output", () =>
    Effect.gen(function* () {
      mockGetLlmsSectionIndexText.mockReturnValue(
        Effect.succeed("# Nakafa English Content")
      );

      const text = yield* Effect.promise(() =>
        getCachedLlmsSectionIndexText({ cleanSlug: "llms/en" })
      );

      expect(text).toBe("# Nakafa English Content");
      expect(mockApplyContentRuntimeCache).toHaveBeenCalledOnce();
      expect(mockGetLlmsSectionIndexText).toHaveBeenCalledExactlyOnceWith(
        "llms/en"
      );
    })
  );
});

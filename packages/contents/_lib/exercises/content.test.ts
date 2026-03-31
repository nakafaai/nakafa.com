import { afterEach, describe, expect, it, vi } from "vitest";

const { mockGetScopedContent } = vi.hoisted(() => ({
  mockGetScopedContent: vi.fn(),
}));

vi.mock("@repo/contents/_lib/scoped", () => ({
  getScopedContent: mockGetScopedContent,
}));

import { getExerciseContent } from "@repo/contents/_lib/exercises/content";

describe("getExerciseContent", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("delegates exercise content loading with explicit options", () => {
    getExerciseContent(
      "en",
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/_question",
      { includeMDX: false }
    );

    expect(mockGetScopedContent).toHaveBeenCalledWith(
      "exercises",
      expect.any(Function),
      "en",
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/_question",
      { includeMDX: false }
    );
  });

  it("delegates exercise content loading with default options", () => {
    getExerciseContent(
      "en",
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/_question"
    );

    expect(mockGetScopedContent).toHaveBeenCalledWith(
      "exercises",
      expect.any(Function),
      "en",
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1/_question",
      {}
    );
  });
});

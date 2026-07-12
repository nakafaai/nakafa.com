// @vitest-environment node
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLearningProfile,
  getUserInfo,
  getVerified,
} from "@/app/api/chat/utils";

vi.mock("convex/nextjs", () => ({
  fetchMutation: vi.fn(),
  fetchQuery: vi.fn(),
}));

vi.mock("@/app/api/chat/nakafa-content", async () => {
  const { Effect } = await import("effect");

  return {
    nakafaContent: {
      /** Verifies chat content refs through deterministic URL fixtures. */
      verify: (url: string) =>
        Effect.succeed(
          url === "https://nakafa.com/id/quran/1" ||
            url ===
              "https://nakafa.com/id/articles/politics/dynastic-politics-asian-values" ||
            url ===
              "https://nakafa.com/en/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge" ||
            url === "asset:id:quran:quran-surah:1" ||
            url === "nakafa://content/asset:id:quran:quran-surah:1"
        ),
    },
  };
});

describe("app/api/chat/utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["https://nakafa.com/id/quran/1", true],
    [
      "https://nakafa.com/id/articles/politics/dynastic-politics-asian-values",
      true,
    ],
    [
      "https://nakafa.com/en/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
      true,
    ],
    ["asset:id:quran:quran-surah:1", true],
    ["nakafa://content/asset:id:quran:quran-surah:1", true],
    ["/id/quran/1", false],
    ["quran/1", false],
    ["https://nakafa.com/id/quran/1/al-fatihah", false],
    ["https://nakafa.com/id/articles/missing", false],
  ] as const)("verifies %s", async (url, expected) => {
    const isVerified = await Effect.runPromise(getVerified(url));

    expect(isVerified).toBe(expected);
  });

  it("fetches chat user info through the sync mutation", async () => {
    vi.mocked(fetchMutation).mockResolvedValue({
      role: "student",
      credits: 7,
      userId: "user_123",
    });

    const userInfo = await Effect.runPromise(getUserInfo("test-token"));

    expect(userInfo).toEqual({
      role: "student",
      credits: 7,
      userId: "user_123",
    });
    expect(fetchMutation).toHaveBeenCalledWith(
      convexApi.users.mutations.syncUserInfoForChat,
      {},
      {
        token: "test-token",
      }
    );
  });

  it("fetches active learning profile through the shared Convex query", async () => {
    const learningProfile = {
      interests: ["exam-prep", "assessment-prep"],
      planItems: [
        {
          content_id:
            "asset:en:tryout:indonesia:snbt:tryout-section:indonesia:snbt:2027:set-1:quantitative-knowledge",
          lensId: "lens:snbt",
          position: 1,
          reason: "program-alignment",
          route: "/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
          status: "ready",
          title: "SNBT Set 1",
        },
      ],
      program: {
        coverageStatus: "partial",
        description: "UTBK-SNBT preparation for the 2026 admission cycle.",
        displayOrder: 40,
        key: "snbt",
        kind: "admission-exam",
        navigation: {
          levels: ["section", "domain", "set"],
          model: "exam-domain-set",
        },
        title: "SNBT 2026",
        versionLabel: "2026",
      },
    };
    vi.mocked(fetchQuery).mockResolvedValue(learningProfile);

    const result = await Effect.runPromise(
      getLearningProfile("test-token", "en")
    );

    expect(result).toEqual({
      interests: ["exam-prep", "assessment-prep"],
      planItems: [
        {
          content_id:
            "asset:en:tryout:indonesia:snbt:tryout-section:indonesia:snbt:2027:set-1:quantitative-knowledge",
          lensId: "lens:snbt",
          position: 1,
          route: "/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
          status: "ready",
          title: "SNBT Set 1",
        },
      ],
      program: {
        coverageStatus: "partial",
        key: "snbt",
        kind: "admission-exam",
        title: "SNBT 2026",
        versionLabel: "2026",
      },
    });
    expect(fetchQuery).toHaveBeenCalledWith(
      convexApi.learningPrograms.queries.getActiveProfile,
      { locale: "en" },
      {
        token: "test-token",
      }
    );
  });
});

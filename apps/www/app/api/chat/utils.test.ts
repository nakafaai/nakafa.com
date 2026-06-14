// @vitest-environment node
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import { fetchMutation } from "convex/nextjs";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserInfo, getVerified } from "@/app/api/chat/utils";

vi.mock("convex/nextjs", () => ({
  fetchMutation: vi.fn(),
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
              "https://nakafa.com/en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-2/1" ||
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
      "https://nakafa.com/en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-2/1",
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
});

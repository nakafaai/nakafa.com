// @vitest-environment node
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import { fetchMutation } from "convex/nextjs";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserInfo, getVerified } from "@/app/api/chat/utils";

vi.mock("convex/nextjs", () => ({
  fetchMutation: vi.fn(),
}));

vi.mock("@repo/contents/_lib/agent/read/markdown", async () => {
  const { Effect, Option } = await import("effect");

  return {
    getNakafaAgentMarkdown: (contentRef: string) => {
      if (contentRef.includes("/missing")) {
        return Effect.succeed(Option.none());
      }

      return Effect.succeed(Option.some({ contentRef }));
    },
  };
});

vi.mock("@repo/contents/_lib/quran", async () => {
  const { Effect } = await import("effect");

  return {
    getSurah: (surah: number) => {
      if (surah !== 1) {
        return Effect.fail(new Error("Missing Surah."));
      }

      return Effect.succeed({
        number: 1,
        numberOfVerses: 1,
      });
    },
  };
});

describe("app/api/chat/utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["/id/quran/1", true],
    ["/id/articles/politics/dynastic-politics-asian-values", true],
    [
      "/en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-2/1",
      true,
    ],
    ["/quran/1", true],
    ["/id/quran/1/al-fatihah", false],
    ["/id/articles/missing", false],
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

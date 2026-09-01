// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { api as convexApi } from "@repo/backend/convex/_generated/api";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { Effect } from "effect";
import { ChatMutationError, ChatQueryError } from "@/app/api/chat/errors";
import {
  getCurriculumPreference,
  getUserInfo,
  getVerified,
} from "@/app/api/chat/utils";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
}));

vi.mock("convex/nextjs", () => ({
  fetchMutation: vi.fn(),
  fetchQuery: vi.fn(),
}));

vi.mock("@/app/api/chat/nakafa-content", () => ({
  nakafaContent: { verify: mocks.verify },
}));

describe("app/api/chat/utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verify.mockImplementation((url: string) =>
      Effect.succeed(
        url === "https://nakafa.com/id/quran/1" ||
          url ===
            "https://nakafa.com/id/articles/politics/dynastic-politics-asian-values" ||
          url ===
            "https://nakafa.com/en/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge" ||
          url === "asset:id:quran:quran-surah:1" ||
          url === "nakafa://content/asset:id:quran:quran-surah:1"
      )
    );
  });

  it.effect.each([
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
  ] as const)("verifies %s", ([url, expected]) =>
    Effect.gen(function* () {
      const isVerified = yield* getVerified(url);

      expect(isVerified).toBe(expected);
    })
  );

  it.effect("fetches chat user info through the sync mutation", () =>
    Effect.gen(function* () {
      vi.mocked(fetchMutation).mockResolvedValue({
        role: "student",
        credits: 7,
        userId: "user_123",
      });

      const userInfo = yield* getUserInfo("test-token");

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
    })
  );

  it.effect(
    "maps user synchronization failures into the mutation error contract",
    () =>
      Effect.gen(function* () {
        const cause = new Error("mutation unavailable");
        vi.mocked(fetchMutation).mockRejectedValueOnce(cause);

        const error = yield* getUserInfo("test-token").pipe(Effect.flip);

        expect(error).toBeInstanceOf(ChatMutationError);
        expect(error).toMatchObject({
          cause,
          operation: "sync-user",
        });
      })
  );

  it.effect(
    "fetches the curriculum preference through the shared Convex query",
    () =>
      Effect.gen(function* () {
        const curriculumPreference = {
          preferredCurriculumProgramKey: "cambridge-international",
          program: {
            countryCode: "GB",
            key: "cambridge-international",
            publicSlug: "cambridge-international",
            title: "Cambridge International",
          },
        };
        vi.mocked(fetchQuery).mockResolvedValue(curriculumPreference);

        const result = yield* getCurriculumPreference("test-token", "en");

        expect(result).toEqual({
          program: {
            key: "cambridge-international",
            title: "Cambridge International",
          },
        });
        expect(fetchQuery).toHaveBeenCalledWith(
          convexApi.learningPreferences.queries.getCurrent,
          { locale: "en" },
          {
            token: "test-token",
          }
        );
      })
  );

  it.effect(
    "maps curriculum-preference failures into the query error contract",
    () =>
      Effect.gen(function* () {
        const cause = new Error("query unavailable");
        vi.mocked(fetchQuery).mockRejectedValueOnce(cause);

        const error = yield* getCurriculumPreference("test-token", "en").pipe(
          Effect.flip
        );

        expect(error).toBeInstanceOf(ChatQueryError);
        expect(error).toMatchObject({
          cause,
          operation: "load-curriculum-preference",
        });
      })
  );

  it.effect("keeps a missing curriculum preference absent", () =>
    Effect.gen(function* () {
      vi.mocked(fetchQuery).mockResolvedValue(null);

      const result = yield* getCurriculumPreference("test-token", "de");

      expect(result).toBeNull();
    })
  );
});

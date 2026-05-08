import { api as convexApi } from "@repo/backend/convex/_generated/api";
import { getContent } from "@repo/contents/_lib/content";
import {
  getExerciseByNumber,
  getExercisesContent,
} from "@repo/contents/_lib/exercises/set";
import { getSurah } from "@repo/contents/_lib/quran";
import {
  ExerciseLoadError,
  InvalidPathError,
  SurahNotFoundError,
} from "@repo/contents/_shared/error";
import { fetchMutation } from "convex/nextjs";
import { Effect, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserInfo, getVerified } from "@/app/api/chat/utils";

const quranSurah = {
  number: 1,
  sequence: 5,
  numberOfVerses: 7,
  name: {
    short: "الفاتحة",
    long: "سورة الفاتحة",
    transliteration: {
      en: "Al-Fatihah",
      id: "Al-Fatihah",
    },
    translation: {
      en: "The Opening",
      id: "Pembukaan",
    },
  },
  revelation: {
    arab: "مكية",
    en: "Meccan",
    id: "Makkiyah",
  },
  verses: [],
} satisfies Effect.Effect.Success<ReturnType<typeof getSurah>>;

const content = {
  metadata: {
    title: "Vector Addition",
    authors: [{ name: "Nabil Akbarazzima Fatih" }],
    date: "04/12/2025",
    description:
      "Master vector addition using triangle, parallelogram & polygon methods.",
    subject: "Vector and Operations",
  },
  raw: "Vector addition differs from scalar addition.",
} satisfies Effect.Effect.Success<ReturnType<typeof getContent>>;

vi.mock("@repo/contents/_lib/content", () => ({
  getContent: vi.fn(),
}));

vi.mock("@repo/contents/_lib/exercises/set", () => ({
  getExerciseByNumber: vi.fn(),
  getExercisesContent: vi.fn(),
}));

vi.mock("@repo/contents/_lib/quran", () => ({
  getSurah: vi.fn(),
}));

vi.mock("convex/nextjs", () => ({
  fetchMutation: vi.fn(),
}));

describe("app/api/chat/utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for invalid quran slugs", async () => {
    const isVerified = await Effect.runPromise(
      getVerified("/id/quran/1/al-fatihah")
    );

    expect(isVerified).toBe(false);
    expect(getSurah).not.toHaveBeenCalled();
  });

  it("returns false for nonnumeric quran slugs", async () => {
    const isVerified = await Effect.runPromise(
      getVerified("/id/quran/not-a-number")
    );

    expect(isVerified).toBe(false);
    expect(getSurah).not.toHaveBeenCalled();
  });

  it("returns false when a verified route has no locale", async () => {
    const isVerified = await Effect.runPromise(getVerified("/quran/1"));

    expect(isVerified).toBe(false);
    expect(getSurah).not.toHaveBeenCalled();
  });

  it("verifies valid quran slugs", async () => {
    vi.mocked(getSurah).mockReturnValue(Effect.succeed(quranSurah));

    const isVerified = await Effect.runPromise(getVerified("/id/quran/1"));

    expect(isVerified).toBe(true);
    expect(getSurah).toHaveBeenCalledWith(1);
  });

  it("returns false when quran lookup fails", async () => {
    vi.mocked(getSurah).mockReturnValue(
      Effect.fail(new SurahNotFoundError({ surahNumber: 1 }))
    );

    const isVerified = await Effect.runPromise(getVerified("/id/quran/1"));

    expect(isVerified).toBe(false);
  });

  it("verifies exercise set slugs", async () => {
    vi.mocked(getExercisesContent).mockReturnValue(
      Effect.succeed([
        {
          number: 1,
          question: {
            metadata: content.metadata,
            default: undefined,
            raw: "Question",
          },
          answer: {
            metadata: content.metadata,
            default: undefined,
            raw: "Answer",
          },
          choices: { en: [], id: [] },
        },
      ])
    );

    const isVerified = await Effect.runPromise(
      getVerified(
        "/id/exercises/high-school/snbt/general-reasoning/try-out/2026/set-10"
      )
    );

    expect(isVerified).toBe(true);
    expect(getExercisesContent).toHaveBeenCalledWith({
      locale: "id",
      filePath:
        "exercises/high-school/snbt/general-reasoning/try-out/2026/set-10",
      includeMDX: false,
    });
  });

  it("verifies single exercise slugs", async () => {
    vi.mocked(getExerciseByNumber).mockReturnValue(
      Effect.succeed(
        Option.some({
          number: 1,
          question: {
            metadata: content.metadata,
            default: undefined,
            raw: "Question",
          },
          answer: {
            metadata: content.metadata,
            default: undefined,
            raw: "Answer",
          },
          choices: { en: [], id: [] },
        })
      )
    );

    const isVerified = await Effect.runPromise(
      getVerified(
        "/id/exercises/high-school/snbt/general-reasoning/try-out/2026/set-10/1"
      )
    );

    expect(isVerified).toBe(true);
    expect(getExerciseByNumber).toHaveBeenCalledWith(
      "id",
      "exercises/high-school/snbt/general-reasoning/try-out/2026/set-10",
      1,
      false
    );
  });

  it("returns false when a single exercise does not exist", async () => {
    vi.mocked(getExerciseByNumber).mockReturnValue(
      Effect.succeed(Option.none())
    );

    const isVerified = await Effect.runPromise(
      getVerified(
        "/id/exercises/high-school/snbt/general-reasoning/try-out/2026/set-10/1"
      )
    );

    expect(isVerified).toBe(false);
  });

  it("returns false when exercise lookup fails", async () => {
    vi.mocked(getExercisesContent).mockReturnValue(
      Effect.fail(
        new ExerciseLoadError({
          path: "exercises/high-school/snbt/general-reasoning/try-out/2026/set-10",
          reason: "missing",
        })
      )
    );

    const isVerified = await Effect.runPromise(
      getVerified(
        "/id/exercises/high-school/snbt/general-reasoning/try-out/2026/set-10"
      )
    );

    expect(isVerified).toBe(false);
  });

  it("verifies real content slugs", async () => {
    vi.mocked(getContent).mockReturnValue(Effect.succeed(content));

    const isVerified = await Effect.runPromise(
      getVerified(
        "/id/subject/high-school/10/mathematics/vector-operations/vector-addition"
      )
    );

    expect(isVerified).toBe(true);
    expect(getContent).toHaveBeenCalledWith(
      "id",
      "subject/high-school/10/mathematics/vector-operations/vector-addition",
      {
        includeMDX: false,
      }
    );
  });

  it("returns false when content lookup fails", async () => {
    vi.mocked(getContent).mockReturnValue(
      Effect.fail(
        new InvalidPathError({
          path: "subject/high-school/10/mathematics/vector-operations/vector-addition",
          reason: "missing",
        })
      )
    );

    const isVerified = await Effect.runPromise(
      getVerified(
        "/id/subject/high-school/10/mathematics/vector-operations/vector-addition"
      )
    );

    expect(isVerified).toBe(false);
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

import { api as convexApi } from "@repo/backend/convex/_generated/api";
import { api } from "@repo/connection/routes";
import { fetchMutation } from "convex/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserInfo, getVerified } from "./utils";

const quranSurahResult: Awaited<ReturnType<typeof api.contents.getSurah>> = {
  data: {
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
  },
  error: null,
};

const contentResult: Awaited<ReturnType<typeof api.contents.getContent>> = {
  data: {
    metadata: {
      title: "Vector Addition",
      authors: [{ name: "Nabil Akbarazzima Fatih" }],
      date: "04/12/2025",
      description:
        "Master vector addition using triangle, parallelogram & polygon methods.",
      subject: "Vector and Operations",
    },
    raw: "Vector addition differs from scalar addition.",
    url: "/subject/high-school/10/mathematics/vector-operations/vector-addition",
    locale: "en",
    slug: "subject/high-school/10/mathematics/vector-operations/vector-addition",
  },
  error: null,
};

vi.mock("@repo/connection/routes", () => ({
  api: {
    contents: {
      getContent: vi.fn(),
      getExercises: vi.fn(),
      getSurah: vi.fn(),
    },
  },
}));

vi.mock("convex/nextjs", () => ({
  fetchMutation: vi.fn(),
}));

describe("app/api/chat/utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for invalid quran slugs", async () => {
    const isVerified = await getVerified("/id/quran/1");

    expect(isVerified).toBe(false);
    expect(api.contents.getSurah).not.toHaveBeenCalled();
  });

  it("verifies valid quran slugs", async () => {
    vi.mocked(api.contents.getSurah).mockResolvedValue(quranSurahResult);

    const isVerified = await getVerified("/id/quran/1/al-fatihah");

    expect(isVerified).toBe(true);
    expect(api.contents.getSurah).toHaveBeenCalledWith({ surah: 1 });
  });

  it("returns false when quran lookup fails", async () => {
    vi.mocked(api.contents.getSurah).mockResolvedValue({
      data: null,
      error: { message: "not found", status: 404 },
    });

    const isVerified = await getVerified("/quran/1/al-fatihah");

    expect(isVerified).toBe(false);
  });

  it("verifies real exercise slugs", async () => {
    vi.mocked(api.contents.getExercises).mockResolvedValue({
      data: [],
      error: null,
    });

    const isVerified = await getVerified(
      "/exercises/high-school/snbt/general-reasoning/try-out/2026/set-10/1"
    );

    expect(isVerified).toBe(true);
    expect(api.contents.getExercises).toHaveBeenCalledWith({
      slug: "exercises/high-school/snbt/general-reasoning/try-out/2026/set-10/1",
    });
  });

  it("returns false when exercise lookup fails", async () => {
    vi.mocked(api.contents.getExercises).mockResolvedValue({
      data: null,
      error: { message: "missing", status: 404 },
    });

    const isVerified = await getVerified(
      "/exercises/high-school/snbt/general-reasoning/try-out/2026/set-10/1"
    );

    expect(isVerified).toBe(false);
  });

  it("verifies real content slugs", async () => {
    vi.mocked(api.contents.getContent).mockResolvedValue(contentResult);

    const isVerified = await getVerified(
      "/subject/high-school/10/mathematics/vector-operations/vector-addition"
    );

    expect(isVerified).toBe(true);
    expect(api.contents.getContent).toHaveBeenCalledWith({
      slug: "subject/high-school/10/mathematics/vector-operations/vector-addition",
    });
  });

  it("returns false when content lookup fails", async () => {
    vi.mocked(api.contents.getContent).mockResolvedValue({
      data: null,
      error: { message: "missing", status: 404 },
    });

    const isVerified = await getVerified(
      "/subject/high-school/10/mathematics/vector-operations/vector-addition"
    );

    expect(isVerified).toBe(false);
  });

  it("fetches chat user info through the sync mutation", async () => {
    vi.mocked(fetchMutation).mockResolvedValue({
      role: "student",
      credits: 7,
      userId: "user_123",
    });

    const userInfo = await getUserInfo("test-token");

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

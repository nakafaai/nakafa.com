import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as route from "./route";

const runtimeMocks = vi.hoisted(() => ({
  getExerciseApiQuestionPage: vi.fn(),
  getExerciseApiSetPage: vi.fn(),
  getMaterialApiContentPage: vi.fn(),
  listApiStaticParams: vi.fn(),
}));
const loggingMocks = vi.hoisted(() => ({
  logError: vi.fn(),
}));

vi.mock("@repo/utilities/logging/effect", async () => {
  const { Effect } = await import("effect");

  return {
    logError: (...args: unknown[]) => {
      loggingMocks.logError(...args);
      return Effect.void;
    },
  };
});

vi.mock("@/lib/content/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content/runtime")>();

  return {
    ...actual,
    getExerciseApiQuestionPage: runtimeMocks.getExerciseApiQuestionPage,
    getExerciseApiSetPage: runtimeMocks.getExerciseApiSetPage,
    getMaterialApiContentPage: runtimeMocks.getMaterialApiContentPage,
    listApiStaticParams: runtimeMocks.listApiStaticParams,
  };
});

const materialRow = {
  description: "Logarithm lesson.",
  locale: "id",
  route:
    "material/lesson/mathematics/exponential-logarithm/logarithm-definition",
  slug: "logarithm-definition",
  title: "Definisi Logaritma",
};

describe("material content API route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("generates static params from the Convex route catalog", async () => {
    const params = [
      { locale: "id", slug: ["high-school", "10", "mathematics"] },
    ];
    runtimeMocks.listApiStaticParams.mockResolvedValue(params);

    await expect(route.generateStaticParams()).resolves.toEqual(params);
    expect(runtimeMocks.listApiStaticParams).toHaveBeenCalledWith({
      prefix: "material/",
      section: "material",
    });
  });

  it("returns the pagination envelope for default material requests", async () => {
    const page = {
      continueCursor: "",
      isDone: true,
      page: [materialRow],
    };

    runtimeMocks.getMaterialApiContentPage.mockReturnValue(
      Effect.succeed(page)
    );

    const response = await route.GET(
      new Request("http://localhost/contents/id/material/lesson/mathematics"),
      {
        params: Promise.resolve({
          locale: "id",
          slug: ["lesson", "mathematics"],
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    expect(runtimeMocks.getMaterialApiContentPage).toHaveBeenCalledWith({
      cursor: null,
      limit: 100,
      locale: "id",
      prefix: "material/lesson/mathematics",
    });
  });

  it("returns the pagination envelope for explicit material pagination", async () => {
    const page = {
      continueCursor: "next-cursor",
      isDone: false,
      page: [materialRow],
    };

    runtimeMocks.getMaterialApiContentPage.mockReturnValue(
      Effect.succeed(page)
    );

    const response = await route.GET(
      new Request(
        "http://localhost/contents/id/material/lesson/mathematics?cursor=page-1&limit=1"
      ),
      {
        params: Promise.resolve({
          locale: "id",
          slug: ["lesson", "mathematics"],
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    expect(runtimeMocks.getMaterialApiContentPage).toHaveBeenCalledWith({
      cursor: "page-1",
      limit: 1,
      locale: "id",
      prefix: "material/lesson/mathematics",
    });
  });

  it("returns exercise set content for unified practice material requests", async () => {
    const page = {
      exercises: [{ number: 1, title: "Question 1" }],
      set: {
        slug: "material/practice/assessment/snbt/general-knowledge/set-1",
      },
    };

    runtimeMocks.getExerciseApiSetPage.mockReturnValue(Effect.succeed(page));

    const response = await route.GET(
      new Request(
        "http://localhost/contents/en/material/practice/assessment/snbt/general-knowledge/set-1"
      ),
      {
        params: Promise.resolve({
          locale: "en",
          slug: [
            "practice",
            "assessment",
            "snbt",
            "general-knowledge",
            "set-1",
          ],
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    expect(runtimeMocks.getExerciseApiSetPage).toHaveBeenCalledWith({
      locale: "en",
      slug: "material/practice/assessment/snbt/general-knowledge/set-1",
    });
    expect(runtimeMocks.getMaterialApiContentPage).not.toHaveBeenCalled();
  });

  it("returns not found when an exact practice set row is missing", async () => {
    runtimeMocks.getExerciseApiSetPage.mockReturnValue(Effect.succeed(null));

    const response = await route.GET(
      new Request(
        "http://localhost/contents/en/material/practice/assessment/snbt/general-knowledge/set-1"
      ),
      {
        params: Promise.resolve({
          locale: "en",
          slug: [
            "practice",
            "assessment",
            "snbt",
            "general-knowledge",
            "set-1",
          ],
        }),
      }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Content not found." });
    expect(runtimeMocks.getExerciseApiSetPage).toHaveBeenCalledWith({
      locale: "en",
      slug: "material/practice/assessment/snbt/general-knowledge/set-1",
    });
    expect(runtimeMocks.getMaterialApiContentPage).not.toHaveBeenCalled();
  });

  it("returns exercise question content for localized practice question requests", async () => {
    const page = {
      exercise: { number: 9, title: "Question 9" },
      exerciseCount: 10,
    };

    runtimeMocks.getExerciseApiQuestionPage.mockReturnValue(
      Effect.succeed(page)
    );

    const response = await route.GET(
      new Request(
        "http://localhost/contents/id/material/practice/assessment/snbt/pengetahuan-umum/set-1/soal-9"
      ),
      {
        params: Promise.resolve({
          locale: "id",
          slug: [
            "practice",
            "assessment",
            "snbt",
            "pengetahuan-umum",
            "set-1",
            "soal-9",
          ],
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    expect(runtimeMocks.getExerciseApiQuestionPage).toHaveBeenCalledWith({
      locale: "id",
      slug: "material/practice/assessment/snbt/pengetahuan-umum/set-1/9",
    });
    expect(runtimeMocks.getMaterialApiContentPage).not.toHaveBeenCalled();
  });

  it("returns not found when an exact practice question row is missing", async () => {
    runtimeMocks.getExerciseApiQuestionPage.mockReturnValue(
      Effect.succeed(null)
    );

    const response = await route.GET(
      new Request(
        "http://localhost/contents/id/material/practice/assessment/snbt/pengetahuan-umum/set-1/soal-9"
      ),
      {
        params: Promise.resolve({
          locale: "id",
          slug: [
            "practice",
            "assessment",
            "snbt",
            "pengetahuan-umum",
            "set-1",
            "soal-9",
          ],
        }),
      }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Content not found." });
    expect(runtimeMocks.getExerciseApiQuestionPage).toHaveBeenCalledWith({
      locale: "id",
      slug: "material/practice/assessment/snbt/pengetahuan-umum/set-1/9",
    });
    expect(runtimeMocks.getMaterialApiContentPage).not.toHaveBeenCalled();
  });

  it("does not normalize malformed localized question leaves as exact questions", async () => {
    runtimeMocks.getExerciseApiSetPage.mockReturnValue(Effect.succeed(null));

    const response = await route.GET(
      new Request(
        "http://localhost/contents/id/material/practice/assessment/snbt/pengetahuan-umum/set-1/question-9"
      ),
      {
        params: Promise.resolve({
          locale: "id",
          slug: [
            "practice",
            "assessment",
            "snbt",
            "pengetahuan-umum",
            "set-1",
            "question-9",
          ],
        }),
      }
    );

    expect(response.status).toBe(404);
    expect(runtimeMocks.getExerciseApiQuestionPage).not.toHaveBeenCalled();
    expect(runtimeMocks.getExerciseApiSetPage).toHaveBeenCalledWith({
      locale: "id",
      slug: "material/practice/assessment/snbt/pengetahuan-umum/set-1/question-9",
    });
  });

  it("rejects invalid locales before reading Convex", async () => {
    const response = await route.GET(
      new Request("http://localhost/contents/fr/material/lesson/mathematics"),
      {
        params: Promise.resolve({
          locale: "fr",
          slug: ["lesson", "mathematics"],
        }),
      }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid locale. Must be 'en' or 'id'.",
    });
    expect(runtimeMocks.getMaterialApiContentPage).not.toHaveBeenCalled();
  });

  it("rejects invalid pagination before reading Convex", async () => {
    const response = await route.GET(
      new Request(
        "http://localhost/contents/id/material/lesson/mathematics?limit=0"
      ),
      {
        params: Promise.resolve({
          locale: "id",
          slug: ["lesson", "mathematics"],
        }),
      }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid pagination. Limit must be between 1 and 100.",
    });
    expect(runtimeMocks.getMaterialApiContentPage).not.toHaveBeenCalled();
  });

  it("logs Convex read failures and returns an API error", async () => {
    const readError = new Error("Convex unavailable");
    runtimeMocks.getMaterialApiContentPage.mockReturnValue(
      Effect.fail(readError)
    );

    const response = await route.GET(
      new Request("http://localhost/contents/id/material/lesson/mathematics"),
      {
        params: Promise.resolve({
          locale: "id",
          slug: ["lesson", "mathematics"],
        }),
      }
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to fetch contents.",
    });
    expect(loggingMocks.logError).toHaveBeenCalledWith(readError, {
      service: "api-contents",
      locale: "id",
      basePath: "lesson/mathematics",
      slugLength: 2,
      message: "Failed to fetch contents.",
    });
  });

  it("logs root material prefix failures with a readable base path", async () => {
    const readError = new Error("Convex unavailable");
    runtimeMocks.getMaterialApiContentPage.mockReturnValue(
      Effect.fail(readError)
    );

    const response = await route.GET(
      new Request("http://localhost/contents/id/material"),
      {
        params: Promise.resolve({
          locale: "id",
          slug: [],
        }),
      }
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to fetch contents.",
    });
    expect(loggingMocks.logError).toHaveBeenCalledWith(readError, {
      service: "api-contents",
      locale: "id",
      basePath: "/",
      slugLength: 0,
      message: "Failed to fetch contents.",
    });
  });
});

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as route from "./route";

const runtimeMocks = vi.hoisted(() => ({
  getMaterialApiContentPage: vi.fn(),
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
    getMaterialApiContentPage: runtimeMocks.getMaterialApiContentPage,
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

  it("reads every material page at request time", () => {
    expect(route.dynamic).toBe("force-dynamic");
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
      appLocale: "id",
      cursor: null,
      limit: 100,
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
      appLocale: "id",
      cursor: "page-1",
      limit: 1,
      prefix: "material/lesson/mathematics",
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
      error: "Invalid locale. Supported locales: en, id, de.",
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

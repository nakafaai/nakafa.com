import { PublicContentMissingError } from "@repo/backend/client/content/errors";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/contents/[locale]/articles/[...slug]/route";

const runtimeMocks = vi.hoisted(() => ({
  getApiPublishedContent: vi.fn(),
}));
const loggingMocks = vi.hoisted(() => ({
  logError: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/utilities/logging/effect", async () => {
  const { Effect } = await import("effect");

  return {
    logError: (...args: unknown[]) => {
      loggingMocks.logError(...args);
      return Effect.void;
    },
  };
});

vi.mock("@/lib/content/runtime", () => ({
  getApiPublishedContent: runtimeMocks.getApiPublishedContent,
  invalidApiLocaleMessage: "Invalid locale. Supported locales: en, id.",
  parseApiLocale: (locale: string) =>
    locale === "en" || locale === "id" ? locale : null,
}));

const article = {
  artifactHash: `sha256:${"a".repeat(64)}`,
  raw: "# Signed article",
  releaseId: "release-article",
};

describe("article content API route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns one exact signed article", async () => {
    expect(route.dynamic).toBe("force-dynamic");
    runtimeMocks.getApiPublishedContent.mockReturnValue(
      Effect.succeed(article)
    );

    const response = await route.GET(
      new Request(
        "http://localhost/contents/en/articles/politics/signed-article"
      ),
      {
        params: Promise.resolve({
          locale: "en",
          slug: ["politics", "signed-article"],
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(article);
    expect(runtimeMocks.getApiPublishedContent).toHaveBeenCalledWith({
      expected: "article",
      locale: "en",
      publicPath: "articles/politics/signed-article",
    });
  });

  it("rejects invalid locales before reading content", async () => {
    const response = await route.GET(
      new Request(
        "http://localhost/contents/fr/articles/politics/signed-article"
      ),
      {
        params: Promise.resolve({
          locale: "fr",
          slug: ["politics", "signed-article"],
        }),
      }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid locale. Supported locales: en, id.",
    });
    expect(runtimeMocks.getApiPublishedContent).not.toHaveBeenCalled();
  });

  it("returns 404 only for a verified missing public route", async () => {
    runtimeMocks.getApiPublishedContent.mockReturnValue(
      Effect.fail(
        new PublicContentMissingError({
          locale: "en",
          publicPath: "articles/politics/missing",
        })
      )
    );

    const response = await route.GET(
      new Request("http://localhost/contents/en/articles/politics/missing"),
      {
        params: Promise.resolve({
          locale: "en",
          slug: ["politics", "missing"],
        }),
      }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Content not found." });
    expect(loggingMocks.logError).not.toHaveBeenCalled();
  });

  it("logs signed-read failures and returns an API error", async () => {
    const readError = new Error("Signed runtime unavailable");
    runtimeMocks.getApiPublishedContent.mockReturnValue(Effect.fail(readError));

    const response = await route.GET(
      new Request("http://localhost/contents/en/articles/politics/failure"),
      {
        params: Promise.resolve({
          locale: "en",
          slug: ["politics", "failure"],
        }),
      }
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to fetch contents.",
    });
    expect(loggingMocks.logError).toHaveBeenCalledWith(readError, {
      service: "api-contents",
      locale: "en",
      basePath: "politics/failure",
      slugLength: 2,
      message: "Failed to fetch contents.",
    });
  });

  it("logs a root-path failure with readable context", async () => {
    const readError = new Error("Signed runtime unavailable");
    runtimeMocks.getApiPublishedContent.mockReturnValue(Effect.fail(readError));

    await route.GET(new Request("http://localhost/contents/en/articles"), {
      params: Promise.resolve({ locale: "en", slug: [] }),
    });

    expect(loggingMocks.logError).toHaveBeenCalledWith(readError, {
      service: "api-contents",
      locale: "en",
      basePath: "/",
      slugLength: 0,
      message: "Failed to fetch contents.",
    });
  });
});

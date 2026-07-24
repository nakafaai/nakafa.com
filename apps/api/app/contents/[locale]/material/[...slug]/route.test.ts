import { PublicContentMissingError } from "@repo/backend/client/content/errors";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/contents/[locale]/material/[...slug]/route";

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

const material = {
  artifactHash: `sha256:${"b".repeat(64)}`,
  raw: "# Signed lesson",
  releaseId: "release-material",
};

describe("material content API route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns one exact signed material body", async () => {
    expect(route.dynamic).toBe("force-dynamic");
    runtimeMocks.getApiPublishedContent.mockReturnValue(
      Effect.succeed(material)
    );

    const response = await route.GET(
      new Request(
        "http://localhost/contents/id/material/lesson/mathematics/function-concept"
      ),
      {
        params: Promise.resolve({
          locale: "id",
          slug: ["lesson", "mathematics", "function-concept"],
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(material);
    expect(runtimeMocks.getApiPublishedContent).toHaveBeenCalledWith({
      expected: "subject-lesson",
      locale: "id",
      publicPath: "material/lesson/mathematics/function-concept",
    });
  });

  it("rejects invalid locales before reading content", async () => {
    const response = await route.GET(
      new Request(
        "http://localhost/contents/fr/material/lesson/mathematics/function-concept"
      ),
      {
        params: Promise.resolve({
          locale: "fr",
          slug: ["lesson", "mathematics", "function-concept"],
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
          locale: "id",
          publicPath: "material/lesson/mathematics/missing",
        })
      )
    );

    const response = await route.GET(
      new Request(
        "http://localhost/contents/id/material/lesson/mathematics/missing"
      ),
      {
        params: Promise.resolve({
          locale: "id",
          slug: ["lesson", "mathematics", "missing"],
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
      new Request(
        "http://localhost/contents/id/material/lesson/mathematics/failure"
      ),
      {
        params: Promise.resolve({
          locale: "id",
          slug: ["lesson", "mathematics", "failure"],
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
      basePath: "lesson/mathematics/failure",
      slugLength: 3,
      message: "Failed to fetch contents.",
    });
  });

  it("logs a root-path failure with readable context", async () => {
    const readError = new Error("Signed runtime unavailable");
    runtimeMocks.getApiPublishedContent.mockReturnValue(Effect.fail(readError));

    await route.GET(new Request("http://localhost/contents/id/material"), {
      params: Promise.resolve({ locale: "id", slug: [] }),
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

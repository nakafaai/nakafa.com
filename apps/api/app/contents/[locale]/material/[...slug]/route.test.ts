import { it as effectIt } from "@effect/vitest";
import { logError } from "@repo/utilities/logging/effect";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMaterialApiContentPage } from "@/lib/content/runtime";
import * as route from "./route";

const runtimeMocks = vi.hoisted(() => ({
  getMaterialApiContentPage: vi.fn(),
}));
const loggingMocks = vi.hoisted(() => ({
  logError: vi.fn(),
}));

vi.mock("@repo/utilities/logging/effect", { spy: true });
vi.mocked(logError).mockImplementation((error, context) => {
  loggingMocks.logError(error, context);
  return Effect.void;
});

vi.mock("@/lib/content/runtime", { spy: true });
vi.mocked(getMaterialApiContentPage).mockImplementation(
  runtimeMocks.getMaterialApiContentPage
);

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

  effectIt.effect(
    "returns the pagination envelope for default material requests",
    () =>
      Effect.gen(function* () {
        const page = {
          continueCursor: "",
          isDone: true,
          page: [materialRow],
        };

        runtimeMocks.getMaterialApiContentPage.mockReturnValue(
          Effect.succeed(page)
        );

        const response = yield* Effect.promise(() =>
          route.GET(
            new Request(
              "http://localhost/contents/id/material/lesson/mathematics"
            ),
            {
              params: Promise.resolve({
                locale: "id",
                slug: ["lesson", "mathematics"],
              }),
            }
          )
        );

        expect(response.status).toBe(200);
        const body = yield* Effect.promise(() => response.json());
        expect(body).toEqual(page);
        expect(runtimeMocks.getMaterialApiContentPage).toHaveBeenCalledWith({
          appLocale: "id",
          cursor: null,
          limit: 100,
          prefix: "material/lesson/mathematics",
        });
      })
  );

  effectIt.effect(
    "returns the pagination envelope for explicit material pagination",
    () =>
      Effect.gen(function* () {
        const page = {
          continueCursor: "next-cursor",
          isDone: false,
          page: [materialRow],
        };

        runtimeMocks.getMaterialApiContentPage.mockReturnValue(
          Effect.succeed(page)
        );

        const response = yield* Effect.promise(() =>
          route.GET(
            new Request(
              "http://localhost/contents/id/material/lesson/mathematics?cursor=page-1&limit=1"
            ),
            {
              params: Promise.resolve({
                locale: "id",
                slug: ["lesson", "mathematics"],
              }),
            }
          )
        );

        expect(response.status).toBe(200);
        const body = yield* Effect.promise(() => response.json());
        expect(body).toEqual(page);
        expect(runtimeMocks.getMaterialApiContentPage).toHaveBeenCalledWith({
          appLocale: "id",
          cursor: "page-1",
          limit: 1,
          prefix: "material/lesson/mathematics",
        });
      })
  );

  effectIt.effect("rejects invalid locales before reading Convex", () =>
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        route.GET(
          new Request(
            "http://localhost/contents/fr/material/lesson/mathematics"
          ),
          {
            params: Promise.resolve({
              locale: "fr",
              slug: ["lesson", "mathematics"],
            }),
          }
        )
      );

      expect(response.status).toBe(400);
      const body = yield* Effect.promise(() => response.json());
      expect(body).toEqual({
        error: "Invalid locale. Supported locales: en, id, de.",
      });
      expect(runtimeMocks.getMaterialApiContentPage).not.toHaveBeenCalled();
    })
  );

  effectIt.effect("rejects invalid pagination before reading Convex", () =>
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        route.GET(
          new Request(
            "http://localhost/contents/id/material/lesson/mathematics?limit=0"
          ),
          {
            params: Promise.resolve({
              locale: "id",
              slug: ["lesson", "mathematics"],
            }),
          }
        )
      );

      expect(response.status).toBe(400);
      const body = yield* Effect.promise(() => response.json());
      expect(body).toEqual({
        error: "Invalid pagination. Limit must be between 1 and 100.",
      });
      expect(runtimeMocks.getMaterialApiContentPage).not.toHaveBeenCalled();
    })
  );

  effectIt.effect("logs Convex read failures and returns an API error", () =>
    Effect.gen(function* () {
      const readError = new Error("Convex unavailable");
      runtimeMocks.getMaterialApiContentPage.mockReturnValue(
        Effect.fail(readError)
      );

      const response = yield* Effect.promise(() =>
        route.GET(
          new Request(
            "http://localhost/contents/id/material/lesson/mathematics"
          ),
          {
            params: Promise.resolve({
              locale: "id",
              slug: ["lesson", "mathematics"],
            }),
          }
        )
      );

      expect(response.status).toBe(500);
      const body = yield* Effect.promise(() => response.json());
      expect(body).toEqual({
        error: "Failed to fetch contents.",
      });
      expect(loggingMocks.logError).toHaveBeenCalledWith(readError, {
        service: "api-contents",
        locale: "id",
        basePath: "lesson/mathematics",
        slugLength: 2,
        message: "Failed to fetch contents.",
      });
    })
  );

  effectIt.effect(
    "logs root material prefix failures with a readable base path",
    () =>
      Effect.gen(function* () {
        const readError = new Error("Convex unavailable");
        runtimeMocks.getMaterialApiContentPage.mockReturnValue(
          Effect.fail(readError)
        );

        const response = yield* Effect.promise(() =>
          route.GET(new Request("http://localhost/contents/id/material"), {
            params: Promise.resolve({
              locale: "id",
              slug: [],
            }),
          })
        );

        expect(response.status).toBe(500);
        const body = yield* Effect.promise(() => response.json());
        expect(body).toEqual({
          error: "Failed to fetch contents.",
        });
        expect(loggingMocks.logError).toHaveBeenCalledWith(readError, {
          service: "api-contents",
          locale: "id",
          basePath: "/",
          slugLength: 0,
          message: "Failed to fetch contents.",
        });
      })
  );
});

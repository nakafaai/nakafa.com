// @vitest-environment node
import { beforeEach, describe, expect, it } from "@repo/testing/effect";
import { Effect, Option } from "effect";
import { vi } from "vitest";
import {
  type LlmsProxyRouteDecision,
  type LlmsProxyRouteRequest,
  resolveLlmsProxyRoute,
} from "@/lib/llms/routes";

const mockHasLlmsMarkdownSource = vi.hoisted(() => vi.fn());

vi.mock("@/lib/llms/content", () => ({
  hasLlmsMarkdownSource: mockHasLlmsMarkdownSource,
}));

function assertRoute(
  request: LlmsProxyRouteRequest,
  assertion: (decision: LlmsProxyRouteDecision) => void
) {
  return resolveLlmsProxyRoute(request).pipe(Effect.map(assertion));
}

describe("llms proxy route resolver", () => {
  beforeEach(() => {
    mockHasLlmsMarkdownSource.mockReset().mockReturnValue(Effect.succeed(true));
  });

  it.effect(
    "delegates ordinary localized HTML without reading content catalogs",
    () =>
      assertRoute(
        {
          acceptHeader: Option.none(),
          isRscRequest: false,
          method: "GET",
          pathname: "/en/subjects/mathematics/integral",
        },
        (decision) => {
          expect(decision).toEqual({ kind: "delegate" });
          expect(mockHasLlmsMarkdownSource).not.toHaveBeenCalled();
        }
      )
  );

  it.effect(
    "rewrites localized content negotiation to the Markdown handler",
    () =>
      assertRoute(
        {
          acceptHeader: Option.some("text/markdown, text/plain;q=0.8"),
          isRscRequest: false,
          method: "GET",
          pathname: "/en/subjects/mathematics/integral/area",
        },
        (decision) => {
          expect(decision).toEqual({
            kind: "rewrite-markdown",
            localizedRoute: {
              locale: "en",
              markdownExtension: "",
              route: "/subjects/mathematics/integral/area",
            },
          });
        }
      )
  );

  it.effect.each(["UTF-8", '"UTF-8"'])(
    "accepts emitted Markdown charset spelling %s",
    (charset) =>
      assertRoute(
        {
          acceptHeader: Option.some(`text/markdown; charset=${charset}`),
          isRscRequest: false,
          method: "GET",
          pathname: "/en/subjects/mathematics/integral/area",
        },
        (decision) => {
          expect(decision).toMatchObject({ kind: "rewrite-markdown" });
        }
      )
  );

  it.effect.each([
    [".md", "text/x-component;q=0"],
    [".md", "text/x-component;q=0.8"],
    [".mdx", "text/x-component;q=0"],
    [".mdx", "text/x-component;q=0.8"],
  ])(
    "preserves an explicit %s route with %s",
    ([markdownExtension, acceptHeader]) => {
      mockHasLlmsMarkdownSource.mockReturnValueOnce(Effect.succeed(false));

      return assertRoute(
        {
          acceptHeader: Option.some(acceptHeader),
          isRscRequest: false,
          method: "GET",
          pathname: `/id/artikel/tidak-ada${markdownExtension}`,
        },
        (decision) => {
          expect(decision).toEqual({
            kind: "rewrite-markdown",
            localizedRoute: {
              locale: "id",
              markdownExtension,
              route: "/artikel/tidak-ada",
            },
          });
          expect(mockHasLlmsMarkdownSource).not.toHaveBeenCalled();
        }
      );
    }
  );

  it.effect("delegates unsupported locales to normal Next routing", () =>
    assertRoute(
      {
        acceptHeader: Option.some("text/markdown"),
        isRscRequest: false,
        method: "GET",
        pathname: "/fr/articles/example",
      },
      (decision) => {
        expect(decision).toEqual({ kind: "delegate" });
      }
    )
  );

  it.effect("maps the locale root to its bounded Markdown index", () =>
    assertRoute(
      {
        acceptHeader: Option.some("text/markdown"),
        isRscRequest: false,
        method: "GET",
        pathname: "/en",
      },
      (decision) => {
        expect(decision).toEqual({
          kind: "rewrite-markdown",
          localizedRoute: {
            locale: "en",
            markdownExtension: "",
            route: "",
          },
        });
      }
    )
  );

  it.effect(
    "maps the unlocalized homepage to the default-locale Markdown index",
    () =>
      assertRoute(
        {
          acceptHeader: Option.some("text/markdown"),
          isRscRequest: false,
          method: "GET",
          pathname: "/",
        },
        (decision) => {
          expect(decision).toEqual({
            kind: "rewrite-markdown",
            localizedRoute: {
              locale: "en",
              markdownExtension: "",
              route: "",
            },
          });
        }
      )
  );

  it.effect.each([
    "text/html;q=0, text/markdown;q=0",
    "application/json",
    "text/x-component",
    "text/html;q=0, text/markdown; charset=iso-8859-1",
    "text/html;q=invalid, text/markdown;q=invalid",
  ])("rejects an unacceptable representation request %s", (acceptHeader) =>
    assertRoute(
      {
        acceptHeader: Option.some(acceptHeader),
        isRscRequest: false,
        method: "GET",
        pathname: "/en/terms-of-service",
      },
      (decision) => {
        expect(decision).toEqual({ kind: "not-acceptable" });
      }
    )
  );

  it.effect.each([
    "*/*",
    "text/html; charset=utf-8",
    "text/html;q=0.8, text/markdown;q=0.8",
    "text/markdown;q=0.5, text/html;q=0.6",
  ])("prefers HTML for %s", (acceptHeader) =>
    assertRoute(
      {
        acceptHeader: Option.some(acceptHeader),
        isRscRequest: false,
        method: "GET",
        pathname: "/en/terms-of-service",
      },
      (decision) => {
        expect(decision).toEqual({ kind: "delegate" });
      }
    )
  );

  it.effect("delegates an actual Next.js RSC request", () =>
    assertRoute(
      {
        acceptHeader: Option.some("text/x-component"),
        isRscRequest: true,
        method: "GET",
        pathname: "/en/quran/1",
      },
      (decision) => {
        expect(decision).toEqual({ kind: "delegate" });
        expect(mockHasLlmsMarkdownSource).not.toHaveBeenCalled();
      }
    )
  );

  it.effect("does not misclassify another component-like media type", () =>
    assertRoute(
      {
        acceptHeader: Option.some("text/x-component-other"),
        isRscRequest: false,
        method: "GET",
        pathname: "/en/quran/1",
      },
      (decision) => {
        expect(decision).toEqual({ kind: "not-acceptable" });
      }
    )
  );

  it.effect("ignores an explicitly unacceptable RSC representation", () =>
    assertRoute(
      {
        acceptHeader: Option.some(
          "text/x-component;q=0, text/markdown; charset=utf-8"
        ),
        isRscRequest: false,
        method: "GET",
        pathname: "/en/quran/1",
      },
      (decision) => {
        expect(decision).toMatchObject({ kind: "rewrite-markdown" });
      }
    )
  );

  it.effect("uses server order so a generic text wildcard stays HTML", () => {
    mockHasLlmsMarkdownSource.mockReturnValueOnce(Effect.succeed(false));

    return assertRoute(
      {
        acceptHeader: Option.some("text/*"),
        isRscRequest: false,
        method: "GET",
        pathname: "/en/search",
      },
      (decision) => {
        expect(decision).toEqual({ kind: "delegate" });
        expect(mockHasLlmsMarkdownSource).not.toHaveBeenCalled();
      }
    );
  });

  it.effect(
    "falls back to HTML when wildcard-preferred Markdown is unavailable",
    () => {
      mockHasLlmsMarkdownSource.mockReturnValueOnce(Effect.succeed(false));

      return assertRoute(
        {
          acceptHeader: Option.some("text/*;q=1, text/html;q=0.8"),
          isRscRequest: false,
          method: "GET",
          pathname: "/en/search",
        },
        (decision) => {
          expect(decision).toEqual({ kind: "delegate" });
          expect(mockHasLlmsMarkdownSource).toHaveBeenCalledOnce();
        }
      );
    }
  );

  it.effect("ignores Flight while negotiating ordinary document requests", () =>
    assertRoute(
      {
        acceptHeader: Option.some(
          "text/x-component, text/markdown;q=0.8, text/html;q=0.7"
        ),
        isRscRequest: false,
        method: "GET",
        pathname: "/en/quran/1",
      },
      (decision) => {
        expect(decision).toMatchObject({ kind: "rewrite-markdown" });
      }
    )
  );

  it.effect(
    "falls back to acceptable HTML when Markdown is unavailable",
    () => {
      mockHasLlmsMarkdownSource.mockReturnValueOnce(Effect.succeed(false));

      return assertRoute(
        {
          acceptHeader: Option.some(
            "text/markdown;q=1, text/x-component;q=0.8, text/html;q=0.7"
          ),
          isRscRequest: false,
          method: "GET",
          pathname: "/en/search",
        },
        (decision) => {
          expect(decision).toEqual({ kind: "delegate" });
          expect(mockHasLlmsMarkdownSource).toHaveBeenCalledOnce();
        }
      );
    }
  );

  it.effect(
    "returns 406 when the requested Markdown source is unavailable",
    () => {
      mockHasLlmsMarkdownSource.mockReturnValueOnce(Effect.succeed(false));

      return assertRoute(
        {
          acceptHeader: Option.some("text/markdown"),
          isRscRequest: false,
          method: "GET",
          pathname: "/en/search",
        },
        (decision) => {
          expect(decision).toEqual({ kind: "not-acceptable" });
          expect(mockHasLlmsMarkdownSource).toHaveBeenCalledOnce();
        }
      );
    }
  );
});

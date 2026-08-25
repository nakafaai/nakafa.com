// @vitest-environment node
import { Option } from "effect";
import { describe, expect, it } from "vitest";
import { resolveLlmsProxyRoute } from "@/lib/llms/routes";

describe("llms proxy route resolver", () => {
  it("delegates ordinary localized HTML without reading content catalogs", () => {
    expect(
      resolveLlmsProxyRoute({
        acceptHeader: Option.none(),
        method: "GET",
        pathname: "/en/subjects/mathematics/integral",
      })
    ).toEqual({ kind: "delegate" });
  });

  it("rewrites localized content negotiation to the Markdown handler", () => {
    expect(
      resolveLlmsProxyRoute({
        acceptHeader: Option.some("text/markdown, text/plain;q=0.8"),
        method: "GET",
        pathname: "/en/subjects/mathematics/integral/area",
      })
    ).toEqual({
      kind: "rewrite-markdown",
      localizedRoute: {
        locale: "en",
        markdownExtension: "",
        route: "/subjects/mathematics/integral/area",
      },
    });
  });

  it.each(["UTF-8", '"UTF-8"'])(
    "accepts emitted Markdown charset spelling %s",
    (charset) => {
      expect(
        resolveLlmsProxyRoute({
          acceptHeader: Option.some(`text/markdown; charset=${charset}`),
          method: "GET",
          pathname: "/en/subjects/mathematics/integral/area",
        })
      ).toMatchObject({ kind: "rewrite-markdown" });
    }
  );

  it("rewrites explicit Markdown suffixes without catalog verification", () => {
    expect(
      resolveLlmsProxyRoute({
        acceptHeader: Option.some("text/html"),
        method: "GET",
        pathname: "/id/artikel/tidak-ada.mdx",
      })
    ).toEqual({
      kind: "rewrite-markdown",
      localizedRoute: {
        locale: "id",
        markdownExtension: ".mdx",
        route: "/artikel/tidak-ada",
      },
    });
  });

  it("delegates unsupported locales to normal Next routing", () => {
    expect(
      resolveLlmsProxyRoute({
        acceptHeader: Option.some("text/markdown"),
        method: "GET",
        pathname: "/fr/articles/example",
      })
    ).toEqual({ kind: "delegate" });
  });

  it("maps the locale root to its bounded Markdown index", () => {
    expect(
      resolveLlmsProxyRoute({
        acceptHeader: Option.some("text/markdown"),
        method: "GET",
        pathname: "/en",
      })
    ).toEqual({
      kind: "rewrite-markdown",
      localizedRoute: {
        locale: "en",
        markdownExtension: "",
        route: "",
      },
    });
  });

  it("maps the unlocalized homepage to the default-locale Markdown index", () => {
    expect(
      resolveLlmsProxyRoute({
        acceptHeader: Option.some("text/markdown"),
        method: "GET",
        pathname: "/",
      })
    ).toEqual({
      kind: "rewrite-markdown",
      localizedRoute: {
        locale: "en",
        markdownExtension: "",
        route: "",
      },
    });
  });

  it.each([
    "text/html;q=0, text/markdown;q=0",
    "application/json",
    "text/html;q=0, text/markdown; charset=iso-8859-1",
    "text/html;q=invalid, text/markdown;q=invalid",
  ])("rejects an unacceptable representation request %s", (acceptHeader) => {
    expect(
      resolveLlmsProxyRoute({
        acceptHeader: Option.some(acceptHeader),
        method: "GET",
        pathname: "/en/terms-of-service",
      })
    ).toEqual({ kind: "not-acceptable" });
  });

  it.each([
    "*/*",
    "text/html; charset=utf-8",
    "text/html;q=0.8, text/markdown;q=0.8",
    "text/markdown;q=0.5, text/html;q=0.6",
  ])("prefers HTML for %s", (acceptHeader) => {
    expect(
      resolveLlmsProxyRoute({
        acceptHeader: Option.some(acceptHeader),
        method: "GET",
        pathname: "/en/terms-of-service",
      })
    ).toEqual({ kind: "delegate" });
  });

  it.each([
    ["POST", "text/x-component"],
    ["GET", "text/x-component"],
    ["HEAD", "text/x-component; charset=utf-8"],
  ])(
    "delegates %s Next.js component traffic with %s",
    (method, acceptHeader) => {
      expect(
        resolveLlmsProxyRoute({
          acceptHeader: Option.some(acceptHeader),
          method,
          pathname: "/en/quran/1",
        })
      ).toEqual({ kind: "delegate" });
    }
  );

  it("does not misclassify another component-like media type", () => {
    expect(
      resolveLlmsProxyRoute({
        acceptHeader: Option.some("text/x-component-other"),
        method: "GET",
        pathname: "/en/quran/1",
      })
    ).toEqual({ kind: "not-acceptable" });
  });
});

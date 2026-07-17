// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveLlmsProxyRoute } from "@/lib/llms/routes";

describe("llms proxy route resolver", () => {
  it("delegates ordinary localized HTML without reading content catalogs", () => {
    expect(
      resolveLlmsProxyRoute({
        acceptHeader: null,
        pathname: "/en/subjects/mathematics/integral",
      })
    ).toEqual({ kind: "delegate" });
  });

  it("rewrites localized content negotiation to the Markdown handler", () => {
    expect(
      resolveLlmsProxyRoute({
        acceptHeader: "text/markdown, text/plain;q=0.8",
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

  it("rewrites explicit Markdown suffixes without catalog verification", () => {
    expect(
      resolveLlmsProxyRoute({
        acceptHeader: null,
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
        acceptHeader: "text/markdown",
        pathname: "/de/articles/example",
      })
    ).toEqual({ kind: "delegate" });
  });

  it("does not map the locale root to the content Markdown handler", () => {
    expect(
      resolveLlmsProxyRoute({
        acceptHeader: "text/markdown",
        pathname: "/en",
      })
    ).toEqual({ kind: "delegate" });
  });
});

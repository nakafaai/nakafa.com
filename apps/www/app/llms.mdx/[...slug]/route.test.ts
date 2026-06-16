// @vitest-environment node
import { Effect } from "effect";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/llms.mdx/[...slug]/route";

const mockGetLlmsMarkdownText = vi.hoisted(() => vi.fn());
const mockGetCachedLlmsSectionIndexText = vi.hoisted(() => vi.fn());

vi.mock("@/lib/llms/content", () => ({
  getLlmsMarkdownText: mockGetLlmsMarkdownText,
}));

vi.mock("@/lib/llms/indexes", () => ({
  buildRootLlmsIndexText: () => "# Nakafa llms index\n",
  getCachedLlmsSectionIndexText: mockGetCachedLlmsSectionIndexText,
}));

describe("llms.mdx route", () => {
  beforeEach(() => {
    mockGetCachedLlmsSectionIndexText.mockReset();
    mockGetLlmsMarkdownText.mockReset();
    mockGetCachedLlmsSectionIndexText.mockResolvedValue(null);
    mockGetLlmsMarkdownText.mockReturnValue(Effect.succeed(null));
  });

  it("serves cached section index markdown before page markdown", async () => {
    mockGetCachedLlmsSectionIndexText.mockResolvedValueOnce(
      "# Subject index\n"
    );

    const response = await GET(
      new NextRequest(
        "https://nakafa.com/llms.mdx/en/curriculum/high-school/12"
      ),
      {
        params: Promise.resolve({
          slug: ["en", "subject", "high-school", "12"],
        }),
      }
    );

    await expect(response.text()).resolves.toBe("# Subject index\n");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(mockGetLlmsMarkdownText).not.toHaveBeenCalled();
  });

  it("serves page markdown for source-backed localized routes", async () => {
    mockGetLlmsMarkdownText.mockReturnValueOnce(
      Effect.succeed("# Terms of Service\n")
    );

    const response = await GET(
      new NextRequest("https://nakafa.com/llms.mdx/en/terms-of-service"),
      {
        params: Promise.resolve({
          slug: ["en", "terms-of-service"],
        }),
      }
    );

    await expect(response.text()).resolves.toBe("# Terms of Service\n");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(mockGetLlmsMarkdownText).toHaveBeenCalledWith({
      cleanSlug: "terms-of-service",
      locale: "en",
    });
  });

  it("serves the root llms index without requiring a locale prefix", async () => {
    const response = await GET(
      new NextRequest("https://nakafa.com/llms.mdx/llms"),
      {
        params: Promise.resolve({
          slug: ["llms"],
        }),
      }
    );

    await expect(response.text()).resolves.toBe("# Nakafa llms index\n");
    expect(response.status).toBe(200);
    expect(mockGetLlmsMarkdownText).toHaveBeenCalledWith({
      cleanSlug: "llms",
      locale: "en",
    });
  });

  it("keeps missing llms index routes as plain 404s", async () => {
    const response = await GET(
      new NextRequest("https://nakafa.com/llms.mdx/en/llms/missing"),
      {
        params: Promise.resolve({
          slug: ["en", "llms", "missing"],
        }),
      }
    );

    await expect(response.text()).resolves.toBe("Not found");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8"
    );
    expect(mockGetLlmsMarkdownText).not.toHaveBeenCalled();
  });

  it("returns a hard 404 markdown body when no page markdown source exists", async () => {
    const response = await GET(
      new NextRequest("https://nakafa.com/llms.mdx/en/search"),
      {
        params: Promise.resolve({
          slug: ["en", "search"],
        }),
      }
    );
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(body).toContain("# Markdown page not found");
    expect(body).toContain("https://nakafa.com/en/search");
    expect(body).toContain("https://nakafa.com/llms/en/site/llms.txt");
  });
});

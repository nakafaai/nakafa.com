// @vitest-environment node
import { Effect } from "effect";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/llms.mdx/[...slug]/route";
import { BASE_URL } from "@/lib/llms/constants";

const mockGetLlmsMarkdownText = vi.hoisted(() => vi.fn());
const mockGetCachedLlmsSectionIndexText = vi.hoisted(() => vi.fn());
const mockResolvePublicLlmsSectionIndex = vi.hoisted(() => vi.fn());

vi.mock("@/lib/llms/content", () => ({
  getLlmsMarkdownText: mockGetLlmsMarkdownText,
}));

vi.mock("@/lib/llms/indexes", () => ({
  getCachedLlmsSectionIndexText: mockGetCachedLlmsSectionIndexText,
}));

vi.mock("@/lib/llms/public-index", () => ({
  buildPublicLlmsAppSectionIndexText: () => "# Nakafa English Curriculum\n",
  buildRootLlmsIndexText: () => "# Nakafa llms index\n",
  resolvePublicLlmsSectionIndex: mockResolvePublicLlmsSectionIndex,
}));

describe("llms.mdx route", () => {
  beforeEach(() => {
    mockGetCachedLlmsSectionIndexText.mockReset();
    mockGetLlmsMarkdownText.mockReset();
    mockResolvePublicLlmsSectionIndex.mockReset();
    mockGetCachedLlmsSectionIndexText.mockResolvedValue(null);
    mockGetLlmsMarkdownText.mockReturnValue(Effect.succeed(null));
    mockResolvePublicLlmsSectionIndex.mockReturnValue(null);
  });

  it("serves cached section index markdown before page markdown", async () => {
    mockGetCachedLlmsSectionIndexText.mockResolvedValueOnce(
      "# Subject index\n"
    );

    const response = await GET(
      new NextRequest(
        "https://nakafa.com/llms.mdx/en/curriculum/merdeka/class-12"
      ),
      {
        params: Promise.resolve({
          slug: ["en", "curriculum", "merdeka", "class-12"],
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

  it("serves internal bounded indexes without treating llms as a locale", async () => {
    mockGetCachedLlmsSectionIndexText.mockResolvedValueOnce(
      "# Bounded Articles\n"
    );

    const response = await GET(
      new NextRequest("https://nakafa.com/llms.mdx/llms/en/articles"),
      {
        params: Promise.resolve({ slug: ["llms", "en", "articles"] }),
      }
    );

    await expect(response.text()).resolves.toBe("# Bounded Articles\n");
    expect(mockResolvePublicLlmsSectionIndex).not.toHaveBeenCalled();
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
    expect(mockGetLlmsMarkdownText).not.toHaveBeenCalled();
  });

  it("serves bounded locale aggregates at localized public paths", async () => {
    mockGetCachedLlmsSectionIndexText.mockResolvedValueOnce(
      "# Nakafa English Content\n"
    );

    const response = await GET(
      new NextRequest("https://nakafa.com/llms.mdx/en/llms.txt"),
      {
        params: Promise.resolve({ slug: ["en"] }),
      }
    );

    await expect(response.text()).resolves.toBe("# Nakafa English Content\n");
    expect(mockGetCachedLlmsSectionIndexText).toHaveBeenCalledWith({
      cleanSlug: "llms/en",
    });
    expect(mockGetLlmsMarkdownText).not.toHaveBeenCalled();
  });

  it("maps localized subject indexes to the bounded material catalog", async () => {
    mockResolvePublicLlmsSectionIndex.mockReturnValueOnce({
      label: "Material",
      prefix: "subjects",
      section: "material",
    });
    mockGetCachedLlmsSectionIndexText.mockResolvedValueOnce(
      "# Nakafa English Material Pages\n"
    );

    const response = await GET(
      new NextRequest("https://nakafa.com/llms.mdx/en/subjects/llms.txt"),
      {
        params: Promise.resolve({ slug: ["en", "subjects"] }),
      }
    );

    await expect(response.text()).resolves.toBe(
      "# Nakafa English Material Pages\n"
    );
    expect(mockGetCachedLlmsSectionIndexText).toHaveBeenCalledWith({
      cleanSlug: "llms/en/material",
    });
    expect(mockGetLlmsMarkdownText).not.toHaveBeenCalled();
  });

  it("serves app-only public indexes without inventing page markdown", async () => {
    mockResolvePublicLlmsSectionIndex.mockReturnValueOnce({
      label: "Curriculum",
      prefix: "curriculum",
    });

    const response = await GET(
      new NextRequest("https://nakafa.com/llms.mdx/en/curriculum/llms.txt"),
      {
        params: Promise.resolve({
          slug: ["en", "curriculum"],
        }),
      }
    );

    await expect(response.text()).resolves.toBe(
      "# Nakafa English Curriculum\n"
    );
    expect(mockGetCachedLlmsSectionIndexText).not.toHaveBeenCalled();
    expect(mockGetLlmsMarkdownText).not.toHaveBeenCalled();
  });

  it("returns a plain 404 for a missing bounded page artifact", async () => {
    const response = await GET(
      new NextRequest(
        "https://nakafa.com/llms.mdx/llms/en/articles/page/999/llms.txt"
      ),
      {
        params: Promise.resolve({
          slug: ["llms", "en", "articles", "page", "999", "llms.txt"],
        }),
      }
    );

    await expect(response.text()).resolves.toBe("Not found");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8"
    );
    expect(mockGetCachedLlmsSectionIndexText).toHaveBeenCalledWith({
      cleanSlug: "llms/en/articles/page/999/llms",
    });
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
    expect(body).toContain(`${BASE_URL}/en/search`);
    expect(body).toContain(`${BASE_URL}/llms/en/site/llms.txt`);
  });
});

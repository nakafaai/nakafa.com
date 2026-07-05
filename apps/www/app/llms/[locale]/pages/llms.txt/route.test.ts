// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/llms/[locale]/pages/llms.txt/route";

const mockGetLlmsPageCatalogIndexText = vi.hoisted(() => vi.fn());

vi.mock("@/lib/llms/page-catalog", () => ({
  getLlmsPageCatalogIndexText: mockGetLlmsPageCatalogIndexText,
}));

describe("llms page catalog route", () => {
  beforeEach(() => {
    mockGetLlmsPageCatalogIndexText.mockReset();
  });

  it("serves source-backed page catalog markdown for a supported locale", async () => {
    mockGetLlmsPageCatalogIndexText.mockReturnValueOnce(
      Effect.succeed("# Nakafa English Page Catalog\n")
    );

    const response = await GET(
      new Request("https://nakafa.com/llms/en/pages/llms.txt"),
      {
        params: Promise.resolve({ locale: "en" }),
      }
    );

    await expect(response.text()).resolves.toBe(
      "# Nakafa English Page Catalog\n"
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(mockGetLlmsPageCatalogIndexText).toHaveBeenCalledWith("en");
  });

  it("rejects unsupported locale page catalog routes", async () => {
    const response = await GET(
      new Request("https://nakafa.com/llms/fr/pages/llms.txt"),
      {
        params: Promise.resolve({ locale: "fr" }),
      }
    );

    await expect(response.text()).resolves.toBe("Not found");
    expect(response.status).toBe(404);
    expect(mockGetLlmsPageCatalogIndexText).not.toHaveBeenCalled();
  });
});

// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { getShellArticleNavigation } from "@/lib/content/article/navigation";
import { getShellPageNavigation } from "@/lib/content/page/navigation";
import { readMarketingShell } from "@/lib/marketing/shell.server";

vi.mock("@/lib/content/article/navigation", () => ({
  getShellArticleNavigation: vi.fn(() =>
    Promise.resolve([{ href: "/articles/math" }])
  ),
}));

vi.mock("@/lib/content/page/navigation", () => ({
  getShellPageNavigation: vi.fn(() => Promise.resolve(null)),
}));

describe("marketing shell", () => {
  it("reads the article and page navigation of the locale", async () => {
    await expect(readMarketingShell("id")).resolves.toStrictEqual({
      articleNavigation: [{ href: "/articles/math" }],
      pageNavigation: null,
    });
    expect(getShellArticleNavigation).toHaveBeenCalledWith("id");
    expect(getShellPageNavigation).toHaveBeenCalledWith("id");
  });
});

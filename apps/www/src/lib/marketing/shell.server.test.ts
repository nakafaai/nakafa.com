// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { getShellArticleNavigation } from "@/lib/content/article/navigation";
import { getShellPageNavigation } from "@/lib/content/page/navigation";
import { readMarketingShell } from "@/lib/marketing/shell.server";

vi.mock("@/lib/content/article/navigation", () => ({
  getShellArticleNavigation: vi.fn(() =>
    Effect.succeed([{ href: "/articles/math" }])
  ),
}));

vi.mock("@/lib/content/page/navigation", () => ({
  getShellPageNavigation: vi.fn(() => Effect.succeed(null)),
}));

describe("marketing shell", () => {
  it.effect("reads the article and page navigation of the locale", () =>
    Effect.gen(function* () {
      expect(yield* readMarketingShell("id")).toStrictEqual({
        articleNavigation: [{ href: "/articles/math" }],
        pageNavigation: null,
      });
      expect(getShellArticleNavigation).toHaveBeenCalledWith("id");
      expect(getShellPageNavigation).toHaveBeenCalledWith("id");
    })
  );
});

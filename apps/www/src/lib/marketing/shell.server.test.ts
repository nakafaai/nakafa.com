// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readTryoutHubRoute } from "@/components/tryout/route/catalog.server";
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

vi.mock("@/components/tryout/route/catalog.server", () => ({
  readTryoutHubRoute: vi.fn((locale: string) =>
    Effect.succeed(
      locale === "id"
        ? { entryPath: "try-out/indonesia", kind: "entry" }
        : { kind: "notFound" }
    )
  ),
}));

describe("marketing shell", () => {
  it.effect(
    "reads the article and page navigation and the try-out entry of the locale",
    () =>
      Effect.gen(function* () {
        expect(yield* readMarketingShell("id")).toStrictEqual({
          articleNavigation: [{ href: "/articles/math" }],
          pageNavigation: null,
          tryoutEntry: "try-out/indonesia",
        });
        expect(getShellArticleNavigation).toHaveBeenCalledWith("id");
        expect(getShellPageNavigation).toHaveBeenCalledWith("id");
        expect(readTryoutHubRoute).toHaveBeenCalledWith("id");
      })
  );

  it.effect("has no try-out entry where the locale has no try-outs", () =>
    Effect.gen(function* () {
      expect((yield* readMarketingShell("en")).tryoutEntry).toBeNull();
    })
  );
});

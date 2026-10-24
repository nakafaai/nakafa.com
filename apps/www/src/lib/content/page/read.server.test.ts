// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { readPublishedPageCatalog } from "@/lib/content/page/catalog";
import { renderCurrentPublishedPage } from "@/lib/content/page/published";
import { readLegalPageHandler } from "@/lib/content/page/read.server";
import { testPageProjection } from "@/test/content-page";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/en/privacy-policy"),
}));

/** A signed page with its rendered body, as the published read answers it. */
const signedPage = (projection: typeof testPageProjection) => ({
  body: "rendered legal body",
  projection,
});

/** The signed page that the published read answers with in the current test. */
let currentPage: Option.Option<ReturnType<typeof signedPage>> = Option.none();

vi.mock("@/lib/content/page/published", () => ({
  renderCurrentPublishedPage: vi.fn(() => Effect.succeed(currentPage)),
}));

vi.mock("@/lib/content/page/catalog", () => ({
  readPublishedPageCatalog: vi.fn(() => Effect.succeed({})),
  verifyPublishedPageCatalog: vi.fn(() => Effect.succeed([])),
}));

describe("legal page head facts", () => {
  it("answers missing for a path that the contracts refuse", async () => {
    await expect(
      readLegalPageHandler({ data: { locale: "en", publicPath: "" } })
    ).resolves.toStrictEqual({ _tag: "Missing" });
    expect(renderCurrentPublishedPage).not.toHaveBeenCalled();
  });

  it("answers missing when no signed page answers the path", async () => {
    await expect(
      readLegalPageHandler({
        data: { locale: "en", publicPath: "privacy-policy" },
      })
    ).resolves.toStrictEqual({ _tag: "Missing" });
    expect(readPublishedPageCatalog).not.toHaveBeenCalled();
  });

  it("returns the title, the description and the alternates of a signed page", async () => {
    currentPage = Option.some(signedPage(testPageProjection));
    const facts = await readLegalPageHandler({
      data: { locale: "en", publicPath: "privacy-policy" },
    });
    expect(facts._tag).toBe("Legal");
    expect(facts).toMatchObject({
      body: "rendered legal body",
      description: testPageProjection.metadata.description,
      title: testPageProjection.metadata.title,
    });
  });
});

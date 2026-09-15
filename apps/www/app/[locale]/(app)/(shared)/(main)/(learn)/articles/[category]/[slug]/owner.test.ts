// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Option } from "effect";
import { resolveArticleOwner } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/owner";

const mocks = vi.hoisted(() => ({
  hasPreviewConfig: vi.fn(),
  readArticlePreview: vi.fn(),
}));

vi.mock("@/lib/content/preview/config", () => ({
  hasPreviewConfig: mocks.hasPreviewConfig,
}));
vi.mock("@/lib/content/preview/article", () => ({
  readArticlePreview: mocks.readArticlePreview,
}));

const input = {
  locale: "en",
  publicPath: PublicPathSchema.make("articles/politics/signed-article"),
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasPreviewConfig.mockReturnValue(false);
  mocks.readArticlePreview.mockReturnValue(Effect.succeed(Option.none()));
});

describe("article ownership", () => {
  it("selects the signed publication without preview work", async () => {
    await expect(resolveArticleOwner(input)).resolves.toEqual({
      kind: "published",
    });
    expect(mocks.readArticlePreview).not.toHaveBeenCalled();
  });

  it("selects the signed publication when no preview resolves", async () => {
    mocks.hasPreviewConfig.mockReturnValue(true);

    await expect(resolveArticleOwner(input)).resolves.toEqual({
      kind: "published",
    });
    expect(mocks.readArticlePreview).toHaveBeenCalledOnce();
  });

  it("selects an authenticated preview", async () => {
    const content = {
      metadata: { title: "Preview title" },
      projection: { slug: "preview" },
    };
    mocks.hasPreviewConfig.mockReturnValue(true);
    mocks.readArticlePreview.mockReturnValue(
      Effect.succeed(Option.some(content))
    );

    await expect(resolveArticleOwner(input)).resolves.toEqual({
      content,
      kind: "preview",
    });
  });
});

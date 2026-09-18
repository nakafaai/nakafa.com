// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { resolveMaterialOwner } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/owner";

const mocks = vi.hoisted(() => ({
  hasPreviewConfig: vi.fn(),
  readMaterialPreview: vi.fn(),
  readMaterialRequest: vi.fn(),
}));

vi.mock(
  "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data",
  () => ({ readMaterialRequest: mocks.readMaterialRequest })
);
vi.mock("@/lib/content/preview/config", () => ({
  hasPreviewConfig: mocks.hasPreviewConfig,
}));
vi.mock("@/lib/content/preview/material", () => ({
  readMaterialPreview: mocks.readMaterialPreview,
}));

const params = Promise.resolve({
  lesson: ["lesson"],
  locale: "en",
  subject: "math",
  topic: "topic",
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasPreviewConfig.mockReturnValue(false);
  mocks.readMaterialRequest.mockResolvedValue({
    locale: "en",
    publicPath: "subjects/math/topic/lesson",
  });
  mocks.readMaterialPreview.mockReturnValue(Effect.succeedNone);
});

describe("material ownership", () => {
  it("selects the signed publication without preview work", async () => {
    await expect(resolveMaterialOwner(params)).resolves.toEqual({
      kind: "published",
      locale: "en",
      publicPath: "subjects/math/topic/lesson",
    });
    expect(mocks.readMaterialPreview).not.toHaveBeenCalled();
  });

  it("selects the signed publication when no preview resolves", async () => {
    mocks.hasPreviewConfig.mockReturnValue(true);

    await expect(resolveMaterialOwner(params)).resolves.toEqual({
      kind: "published",
      locale: "en",
      publicPath: "subjects/math/topic/lesson",
    });
    expect(mocks.readMaterialPreview).toHaveBeenCalledOnce();
  });

  it("selects an authenticated preview with its locale", async () => {
    const preview = {
      appLocale: "en",
      metadata: { title: "Preview title" },
      projection: { slug: "preview" },
    };
    mocks.hasPreviewConfig.mockReturnValue(true);
    mocks.readMaterialPreview.mockReturnValue(Effect.succeedSome(preview));

    await expect(resolveMaterialOwner(params)).resolves.toEqual({
      appLocale: "en",
      kind: "preview",
      preview,
    });
  });

  it("returns null when no public path resolves", async () => {
    mocks.readMaterialRequest.mockResolvedValue({
      locale: "en",
      publicPath: undefined,
    });

    await expect(resolveMaterialOwner(params)).resolves.toBeNull();
  });
});

// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  listMaterialStaticParams,
  parseMaterialParams,
  readMaterialRequest,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import { previewProjection } from "@/test/content-preview";

const mocks = vi.hoisted(() => ({
  getPublishedMaterialRoutes: vi.fn(),
  hasPreviewConfig: vi.fn(() => false),
  readMaterialPreviewStaticParams: vi.fn(),
  readNamespaceSegment: vi.fn(),
  selectLearningStaticParams: vi.fn(),
}));

vi.mock("@repo/contents/_types/route/surface", () => ({
  readNamespaceSegment: mocks.readNamespaceSegment,
}));
vi.mock("@/lib/content/material/catalog", () => ({
  getPublishedMaterialRoutes: mocks.getPublishedMaterialRoutes,
}));
vi.mock("@/lib/content/preview/config", () => ({
  hasPreviewConfig: mocks.hasPreviewConfig,
}));
vi.mock("@/lib/content/preview/route", () => ({
  readMaterialPreviewStaticParams: mocks.readMaterialPreviewStaticParams,
}));
vi.mock("@/lib/routing/prerender", () => ({
  selectLearningStaticParams: mocks.selectLearningStaticParams,
}));

const routeParams = {
  lesson: ["function-concept"],
  locale: "en",
  subject: "mathematics",
  topic: "function-composition-inverse-function",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readNamespaceSegment.mockReturnValue("subjects");
  mocks.getPublishedMaterialRoutes.mockResolvedValue({
    routes: [previewProjection],
    sourceRevision: "a".repeat(40),
  });
  mocks.hasPreviewConfig.mockReturnValue(false);
  mocks.readMaterialPreviewStaticParams.mockResolvedValue({
    lesson: ["function-concept"],
    subject: "mathematics",
    topic: "function-composition-inverse-function",
  });
  mocks.selectLearningStaticParams.mockImplementation((values) => values);
});

describe("material route data", () => {
  it("parses only concrete localized material slugs", () => {
    expect(
      parseMaterialParams("en", [
        "subjects",
        "mathematics",
        "functions",
        "concept",
      ])
    ).toEqual({
      lesson: ["concept"],
      locale: "en",
      subject: "mathematics",
      topic: "functions",
    });
    expect(
      parseMaterialParams("en", ["subjects", "mathematics", "functions"])
    ).toBeNull();
    expect(
      parseMaterialParams("en", ["articles", "politics", "example", "post"])
    ).toBeNull();
    expect(
      parseMaterialParams("en", ["subjects", "", "functions", "concept"])
    ).toBeNull();
  });

  it("builds one exact localized material request", async () => {
    await expect(
      readMaterialRequest(Promise.resolve(routeParams))
    ).resolves.toEqual({
      locale: "en",
      publicPath: previewProjection.publicPath,
    });
    await expect(
      readMaterialRequest(
        Promise.resolve({
          locale: "en",
          subject: routeParams.subject,
          topic: routeParams.topic,
        })
      )
    ).resolves.toEqual({
      locale: "en",
      publicPath: "subjects/mathematics/function-composition-inverse-function",
    });
  });

  it("returns no path when the locale has no material namespace", async () => {
    mocks.readNamespaceSegment.mockReturnValueOnce(undefined);

    await expect(
      readMaterialRequest(Promise.resolve(routeParams))
    ).resolves.toEqual({ locale: "en", publicPath: undefined });
  });

  it("lists static params only from the signed catalog", async () => {
    await expect(listMaterialStaticParams("en")).resolves.toEqual([
      {
        lesson: ["function-concept"],
        subject: "mathematics",
        topic: "function-composition-inverse-function",
      },
    ]);
    expect(mocks.getPublishedMaterialRoutes).toHaveBeenCalledWith("en");
  });

  it("prerenders the selected route inside the local preview child", async () => {
    mocks.hasPreviewConfig.mockReturnValue(true);

    await expect(listMaterialStaticParams("de")).resolves.toEqual([
      {
        lesson: ["function-concept"],
        subject: "mathematics",
        topic: "function-composition-inverse-function",
      },
    ]);
    expect(mocks.getPublishedMaterialRoutes).not.toHaveBeenCalled();
    expect(mocks.readMaterialPreviewStaticParams).toHaveBeenCalledWith("de");
  });
});
